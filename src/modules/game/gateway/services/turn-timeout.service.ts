import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { PlayerStateRedis } from '../redis/player-state.redis';
import { Server } from 'socket.io';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RedisUtils } from '../utils/redis.utils';

/**
 * TurnTimeoutService gestiona el control de tiempo de turnos:
 * - Si un jugador no actúa a tiempo, pierde su turno.
 * - Si omite 3 turnos consecutivos, es expulsado.
 * - Gestiona la transición de turnos entre jugadores.
 */
@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly prismaService: PrismaService,
    private readonly redisUtils: RedisUtils,
    private readonly server: Server,
  ) {}

  /**
   * Inicia un timeout de 30 segundos para el jugador actual.
   */
  async startTurnTimeout(gameId: number, currentUserId: number): Promise<void> {
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);

    setTimeout(() => {
      this.handleTimeout(gameId, currentUserId).catch((error: unknown) => {
        this.logger.error(
          `Error al manejar timeout de turno: ${JSON.stringify(error)}`,
        );
      });
    }, 30_000);

    this.logger.log(
      `Timeout de turno iniciado para userId=${currentUserId} en gameId=${gameId}`,
    );
  }

  /**
   * Limpia el timeout del turno si el jugador actuó a tiempo.
   */
  async clearTurnTimeout(gameId: number): Promise<void> {
    await this.turnStateRedis.clearTurnTimeout(gameId);
    this.logger.log(`Timeout de turno limpiado en gameId=${gameId}`);
  }

  /**
   * Maneja el caso donde un jugador no dispara a tiempo.
   */
  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);

    if (expectedUserId !== currentUserId) {
      this.logger.warn(
        `Timeout ignorado: turno ya cambiado para gameId=${gameId}`,
      );
      return;
    }

    this.logger.warn(
      `Jugador userId=${currentUserId} no actuó a tiempo en gameId=${gameId}`,
    );

    const missedTurns = await this.turnStateRedis.incrementMissedTurns(
      gameId,
      currentUserId,
    );

    if (missedTurns >= 3) {
      // Expulsar jugador
      await this.playerStateRedis.markAsAbandoned(gameId, currentUserId);

      const sockets = this.server.sockets.sockets;
      for (const socket of sockets.values()) {
        const socketUser = socket.data as { userId: number };
        if (socketUser?.userId === currentUserId) {
          socket.emit('player:kicked', {
            reason: 'Abandonaste la partida por inactividad',
          });
          socket.disconnect(true);

          this.logger.warn(
            `Jugador userId=${currentUserId} expulsado por inactividad de gameId=${gameId}`,
          );
          break;
        }
      }

      return; // No se avanza el turno porque ya se expulsó
    }

    // Notificar pérdida de turno
    this.server.to(`game:${gameId}`).emit('turn:timeout', {
      userId: currentUserId,
    });

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Turnos fallidos=${missedTurns}`,
    );

    // Pasar turno normalmente
    await this.passTurn(gameId, currentUserId);
  }

  /**
   * Gestiona el avance del turno hacia el siguiente jugador.
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
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
        `Partida ${gameId} finalizada. Ganador userId=${winner.userId}`,
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
          `Partida ${gameId} finalizada. Equipo ganador=${winningTeam}`,
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
      `Turno avanzado en partida ${gameId}. Nuevo turno para userId=${nextUserId}`,
    );

    // Iniciar timeout para el siguiente turno
    await this.startTurnTimeout(gameId, nextUserId);
  }
}
