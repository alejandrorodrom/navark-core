import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../../../redis/turn-state.redis';
import { PlayerStateRedis } from '../../../redis/player-state.redis';
import { TurnOrchestratorService } from './turn-orchestrator.service';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';

@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);
  private readonly timeouts = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly turnOrchestrator: TurnOrchestratorService,
    private readonly socketServer: SocketServerAdapter,
  ) {}

  async start(gameId: number, currentUserId: number): Promise<void> {
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);
    this.cancel(gameId);

    const timeoutId = setTimeout(() => {
      this.handleTimeout(gameId, currentUserId).catch((error) => {
        this.logger.error(`Error en timeout: ${error}`);
      });
    }, 30_000);

    this.timeouts.set(gameId, timeoutId);
    this.logger.log(
      `Timeout iniciado: gameId=${gameId}, userId=${currentUserId}`,
    );
  }

  async clear(gameId: number): Promise<void> {
    await this.turnStateRedis.clearTurnTimeout(gameId);
    this.logger.log(`Timeout limpiado: gameId=${gameId}`);
  }

  cancel(gameId: number): void {
    const timeoutId = this.timeouts.get(gameId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(gameId);
      this.logger.log(`Timeout cancelado: gameId=${gameId}`);
    }
  }

  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);
    if (expectedUserId !== currentUserId) return;

    const missedTurns = await this.turnStateRedis.incrementMissedTurns(
      gameId,
      currentUserId,
    );

    if (missedTurns >= 3) {
      await this.playerStateRedis.markAsAbandoned(gameId, currentUserId);
      this.socketServer.kickPlayer(currentUserId, {
        reason: 'Abandonaste la partida por inactividad',
      });

      this.logger.warn(
        `Jugador userId=${currentUserId} expulsado por inactividad`,
      );
      return;
    }

    this.socketServer.emitToGame(gameId, 'turn:timeout', {
      userId: currentUserId,
    });

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Fallos=${missedTurns}`,
    );

    await this.turnOrchestrator.passTurn(gameId, currentUserId);
  }
}
