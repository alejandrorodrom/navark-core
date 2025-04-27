import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RedisUtils } from '../utils/redis.utils';
import { SocketWithUser } from '../contracts/socket.types';
import { PlayerFireDto } from '../contracts/player-fire.dto';
import { Server } from 'socket.io';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';

/**
 * FireHandler gestiona la acción de disparar durante una partida.
 * Valída turnos, objetivo, tipos de disparo y actualiza estados relacionados.
 */
@Injectable()
export class FireHandler {
  private readonly logger = new Logger(FireHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly redisUtils: RedisUtils,
    private readonly server: Server,
  ) {}

  /**
   * Ejecuta la lógica cuando un jugador realiza un disparo.
   * @param client Cliente que disparó.
   * @param data Información del disparo (coordenadas, tipo de disparo, partida).
   */
  async onPlayerFire(
    client: SocketWithUser,
    data: PlayerFireDto,
  ): Promise<void> {
    const { gameId, x, y, shotType } = data;
    const room = `game:${gameId}`;

    this.logger.log(
      `Disparo recibido: socketId=${client.id}, gameId=${gameId}, coordenadas=(${x},${y}), tipo=${shotType}`,
    );

    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });
    if (!game || game.status !== 'in_progress') {
      this.logger.warn(
        `Disparo rechazado: partida inválida o no iniciada, gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'Partida no disponible para disparar.',
      });
      return;
    }

    const currentTurnUserId = await this.turnStateRedis.getCurrentTurn(gameId);
    if (currentTurnUserId !== client.data.userId) {
      this.logger.warn(
        `Turno inválido: userId=${client.data.userId} no tiene el turno en gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'No es tu turno',
      });
      return;
    }

    if (shotType === 'nuclear') {
      const hasNuclear = await this.nuclearStateRedis.hasNuclearAvailable(
        gameId,
        client.data.userId,
      );
      const usedNuclear = await this.nuclearStateRedis.hasNuclearUsed(
        gameId,
        client.data.userId,
      );

      if (!hasNuclear) {
        this.logger.warn(
          `Intento de disparo nuclear sin desbloquear: userId=${client.data.userId}, gameId=${gameId}`,
        );
        client.emit('player:fire:ack', {
          success: false,
          error: 'No has desbloqueado la bomba nuclear.',
        });
        return;
      }

      if (usedNuclear) {
        this.logger.warn(
          `Intento de disparo nuclear duplicado: userId=${client.data.userId}, gameId=${gameId}`,
        );
        client.emit('player:fire:ack', {
          success: false,
          error: 'Ya has usado tu bomba nuclear.',
        });
        return;
      }

      await this.nuclearStateRedis.markNuclearUsed(gameId, client.data.userId);
    }

    const target = await this.findNextTarget(gameId, client.data.userId);
    if (!target) {
      this.logger.warn(
        `Sin objetivo válido: userId=${client.data.userId} en partida gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'No hay objetivo válido',
      });
      return;
    }

    const shooter = game.gamePlayers.find(
      (gp) => gp.userId === client.data.userId,
    );
    if (!shooter) {
      this.logger.error(
        `Shooter no encontrado: userId=${client.data.userId}, gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'No se pudo identificar al jugador actual.',
      });
      return;
    }

    if (
      shooter.userId === target.userId ||
      (game.mode === 'teams' && shooter.team === target.team)
    ) {
      this.logger.warn(
        `Disparo inválido: userId=${client.data.userId} intentó disparar a sí mismo o a su equipo en gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'No puedes disparar a ti mismo ni a tu equipo.',
      });
      return;
    }

    const targetPlayer = await this.prismaService.gamePlayer.findUnique({
      where: { id: target.id },
    });
    if (!targetPlayer) {
      this.logger.error(
        `Objetivo no encontrado: targetId=${target.id} en gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'Objetivo no encontrado',
      });
      return;
    }

    const board = targetPlayer.board as {
      size: number;
      ships: Array<{
        type: string;
        coordinates: Array<{ x: number; y: number }>;
      }>;
    };

    const hit = board.ships.some((ship) =>
      ship.coordinates.some((coord) => coord.x === x && coord.y === y),
    );

    this.server.to(room).emit('player:fired', {
      shooterUserId: client.data.userId,
      x,
      y,
      hit,
    });

    await this.handleNuclearProgress(gameId, client.data.userId, hit, shotType);
    await this.sendNuclearStatus(gameId, client);

    client.emit('player:fire:ack', { success: true, hit });

    await this.passTurn(gameId, client.data.userId);
  }

  /**
   * Busca un objetivo válido para disparar.
   */
  private async findNextTarget(gameId: number, shooterUserId: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });
    if (!game) return null;

    const shooter = game.gamePlayers.find((gp) => gp.userId === shooterUserId);
    if (!shooter) return null;

    if (game.mode === 'teams') {
      const enemies = game.gamePlayers.filter(
        (gp) =>
          gp.team !== shooter.team && gp.userId !== shooterUserId && !gp.leftAt,
      );
      return enemies[0] ?? null;
    }

    const enemies = game.gamePlayers.filter(
      (gp) => gp.userId !== shooterUserId && !gp.leftAt,
    );
    return enemies[0] ?? null;
  }

  /**
   * Gestiona el avance del turno al siguiente jugador activo.
   */
  private async passTurn(gameId: number, currentUserId: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });
    if (!game) return;

    const alivePlayers = game.gamePlayers.filter((p) => !p.leftAt);

    if (alivePlayers.length === 1 && game.mode === 'individual') {
      const winner = alivePlayers[0];

      await this.prismaService.gamePlayer.update({
        where: { id: winner.id },
        data: { isWinner: true },
      });
      await this.prismaService.game.update({
        where: { id: gameId },
        data: { status: 'finished' },
      });

      await this.redisUtils.clearGameRedisState(gameId);

      this.server.to(`game:${gameId}`).emit('game:ended', {
        mode: 'individual',
        winnerUserId: winner.userId,
      });

      this.logger.log(
        `Partida ${gameId} terminada. Ganador userId=${winner.userId}`,
      );
      return;
    }

    if (game.mode === 'teams') {
      const teamsAlive = new Set(alivePlayers.map((p) => p.team));

      if (teamsAlive.size === 1) {
        const winningTeam = [...teamsAlive][0];

        await this.prismaService.gamePlayer.updateMany({
          where: { gameId, team: winningTeam },
          data: { isWinner: true },
        });
        await this.prismaService.game.update({
          where: { id: gameId },
          data: { status: 'finished' },
        });

        await this.redisUtils.clearGameRedisState(gameId);

        this.server.to(`game:${gameId}`).emit('game:ended', {
          mode: 'teams',
          winningTeam,
        });

        this.logger.log(
          `Partida ${gameId} terminada. Equipo ganador=${winningTeam}`,
        );
        return;
      }
    }

    const playerOrder = alivePlayers.map((p) => p.userId);
    const currentIndex = playerOrder.indexOf(currentUserId);
    const nextIndex = (currentIndex + 1) % playerOrder.length;
    const nextUserId = playerOrder[nextIndex];

    await this.turnStateRedis.setCurrentTurn(gameId, nextUserId);

    this.server.to(`game:${gameId}`).emit('turn:changed', {
      userId: nextUserId,
    });

    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }

  /**
   * Gestiona el progreso de desbloqueo nuclear en función de los disparos acertados.
   */
  private async handleNuclearProgress(
    gameId: number,
    userId: number,
    hit: boolean,
    shotType: 'simple' | 'cross' | 'multi' | 'area' | 'scan' | 'nuclear',
  ) {
    if (shotType !== 'simple') return;

    if (!hit) {
      await this.nuclearStateRedis.resetNuclearProgress(gameId, userId);
      return;
    }

    const progress = await this.nuclearStateRedis.incrementNuclearProgress(
      gameId,
      userId,
    );

    if (progress === 6) {
      await this.nuclearStateRedis.unlockNuclear(gameId, userId);
      this.logger.log(
        `Usuario ${userId} desbloqueó la bomba nuclear en partida ${gameId}`,
      );
    }
  }

  /**
   * Envía el estado actual de desbloqueo nuclear al jugador.
   */
  private async sendNuclearStatus(gameId: number, client: SocketWithUser) {
    const [progress, available, used] = await Promise.all([
      this.nuclearStateRedis.getNuclearProgress(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
    ]);

    client.emit('nuclear:status', {
      progress,
      hasNuclear: available,
      used,
    });
  }
}
