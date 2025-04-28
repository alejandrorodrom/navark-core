import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { PlayerFireDto } from '../contracts/player-fire.dto';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';
import { GamePlayer } from '../../../../prisma/prisma.types';
import { TurnTimeoutService } from '../services/turn-timeout.service';
import { TurnManagerService } from '../services/turn-manager.service';

/**
 * FireHandler gestiona la acción de disparo durante una partida:
 * - Validaciones de turno, objetivo y tipo de disparo.
 * - Actualización de progreso nuclear.
 * - Avance del turno.
 */
@Injectable()
export class FireHandler {
  private readonly logger = new Logger(FireHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly turnTimeoutService: TurnTimeoutService,
    private readonly turnManagerService: TurnManagerService,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  /**
   * Maneja la acción de disparar de un jugador.
   * @param client Cliente que dispara.
   * @param data Datos del disparo (coordenadas, tipo de disparo, partida).
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
        `Disparo fuera de turno: userId=${client.data.userId} en gameId=${gameId}`,
      );
      client.emit('player:fire:ack', {
        success: false,
        error: 'No es tu turno',
      });
      return;
    }

    if (shotType === 'nuclear') {
      const [hasNuclear, usedNuclear] = await Promise.all([
        this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
        this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
      ]);

      if (!hasNuclear) {
        this.logger.warn(
          `Intento de disparo nuclear no autorizado: userId=${client.data.userId}`,
        );
        client.emit('player:fire:ack', {
          success: false,
          error: 'No has desbloqueado la bomba nuclear.',
        });
        return;
      }
      if (usedNuclear) {
        this.logger.warn(
          `Intento de usar bomba nuclear duplicada: userId=${client.data.userId}`,
        );
        client.emit('player:fire:ack', {
          success: false,
          error: 'Ya has usado tu bomba nuclear.',
        });
        return;
      }

      await this.nuclearStateRedis.markNuclearUsed(gameId, client.data.userId);
    }

    const target = this.findNextTarget(
      game.gamePlayers,
      client.data.userId,
      game.mode,
    );

    if (!target) {
      this.logger.warn(
        `No hay objetivo válido para userId=${client.data.userId} en gameId=${gameId}`,
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
        `Disparo inválido a sí mismo o compañero: userId=${client.data.userId} en gameId=${gameId}`,
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
      this.logger.error(`Objetivo no encontrado: targetId=${target.id}`);
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

    this.webSocketServerService.getServer().to(room).emit('player:fired', {
      shooterUserId: client.data.userId,
      x,
      y,
      hit,
    });

    await this.handleNuclearProgress(gameId, client.data.userId, hit, shotType);
    await this.sendNuclearStatus(gameId, client);

    client.emit('player:fire:ack', { success: true, hit });

    await this.turnTimeoutService.clearTurnTimeout(gameId);
    await this.turnManagerService.passTurn(gameId, client.data.userId);
  }

  /**
   * Encuentra el siguiente objetivo enemigo disponible.
   */
  private findNextTarget(
    gamePlayers: GamePlayer[],
    shooterUserId: number,
    mode: string,
  ): GamePlayer | null {
    const shooter = gamePlayers.find((gp) => gp.userId === shooterUserId);
    if (!shooter) return null;

    if (mode === 'teams') {
      return (
        gamePlayers.find(
          (gp) =>
            gp.team !== shooter.team &&
            gp.userId !== shooterUserId &&
            !gp.leftAt,
        ) ?? null
      );
    }

    return (
      gamePlayers.find((gp) => gp.userId !== shooterUserId && !gp.leftAt) ??
      null
    );
  }

  /**
   * Gestiona el progreso de desbloqueo nuclear basado en aciertos.
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
        `Usuario ${userId} desbloqueó bomba nuclear en partida ${gameId}`,
      );
    }
  }

  /**
   * Envía el estado de progreso nuclear actualizado al cliente.
   */
  private async sendNuclearStatus(gameId: number, client: SocketWithUser) {
    const [progress, available, used] = await Promise.all([
      this.nuclearStateRedis.getNuclearProgress(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
    ]);

    client.emit('nuclear:status', { progress, hasNuclear: available, used });
  }
}
