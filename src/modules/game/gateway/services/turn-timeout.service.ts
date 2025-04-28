import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { PlayerStateRedis } from '../redis/player-state.redis';
import { TurnManagerService } from './turn-manager.service';
import { Server } from 'socket.io';

/**
 * TurnTimeoutService gestiona el control de tiempo de turnos:
 * - Si un jugador no actúa a tiempo, pierde su turno.
 * - Si omite 3 turnos consecutivos, es expulsado.
 */
@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);
  private readonly timeouts = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly turnManagerService: TurnManagerService,
    private readonly server: Server,
  ) {}

  /**
   * Inicia un timeout de 30 segundos para el jugador actual.
   */
  async startTurnTimeout(gameId: number, currentUserId: number): Promise<void> {
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);

    this.cancelTurnTimeout(gameId);

    const timeoutId = setTimeout(() => {
      this.handleTimeout(gameId, currentUserId).catch((error) => {
        this.logger.error(`Error manejando timeout de turno: ${error}`);
      });
    }, 30_000);

    this.timeouts.set(gameId, timeoutId);

    this.logger.log(
      `Timeout de turno iniciado: gameId=${gameId}, userId=${currentUserId}`,
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
   * Cancela el timeout actual de una partida.
   */
  cancelTurnTimeout(gameId: number): void {
    const timeoutId = this.timeouts.get(gameId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(gameId);
      this.logger.log(`Timeout de turno cancelado: gameId=${gameId}`);
    }
  }

  /**
   * Maneja el evento cuando un jugador no actúa a tiempo.
   */
  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);

    if (expectedUserId !== currentUserId) {
      this.logger.warn(
        `Timeout ignorado: turno ya cambiado manualmente. gameId=${gameId}`,
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
            `Jugador userId=${currentUserId} expulsado de gameId=${gameId}`,
          );
          break;
        }
      }
      return;
    }

    // Notificar pérdida de turno
    this.server.to(`game:${gameId}`).emit('turn:timeout', {
      userId: currentUserId,
    });

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Turnos fallidos=${missedTurns}`,
    );

    await this.turnManagerService.passTurn(gameId, currentUserId);
  }
}
