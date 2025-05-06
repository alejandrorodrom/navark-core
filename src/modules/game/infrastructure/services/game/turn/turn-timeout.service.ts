import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../../../redis/turn-state.redis';
import { PlayerStateRedis } from '../../../redis/player-state.redis';
import { TurnOrchestratorService } from './turn-orchestrator.service';
import { GameEventEmitter } from '../../../websocket/events/emitters/game-event.emitter';

/**
 * Servicio que gestiona los tiempos máximos de turno y las penalizaciones por inactividad.
 * Controla timeouts, expulsiones y cambios automáticos de turno.
 */
@Injectable()
export class TurnTimeoutService {
  private readonly logger = new Logger(TurnTimeoutService.name);

  /** Mapa de timeouts activos por juego */
  private readonly timeouts = new Map<number, NodeJS.Timeout>();

  /** Duración del timeout en milisegundos (30 segundos) */
  private readonly TIMEOUT_DURATION = 30_000;

  /** Número máximo de turnos que un jugador puede perder antes de ser expulsado */
  private readonly MAX_MISSED_TURNS = 3;

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly turnOrchestrator: TurnOrchestratorService,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Inicia un nuevo temporizador para el turno actual.
   * Cancela cualquier temporizador previo existente.
   * @param gameId ID de la partida
   * @param currentUserId ID del usuario que tiene el turno actual
   */
  async start(gameId: number, currentUserId: number): Promise<void> {
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);
    this.cancel(gameId);

    const timeoutId = setTimeout(() => {
      this.handleTimeout(gameId, currentUserId).catch((error) => {
        this.logger.error(`Error en timeout: ${error}`);
      });
    }, this.TIMEOUT_DURATION);

    this.timeouts.set(gameId, timeoutId);
    this.logger.log(
      `Timeout iniciado: gameId=${gameId}, userId=${currentUserId}`,
    );
  }

  /**
   * Limpia el estado de timeout en Redis, pero no cancela el temporizador activo.
   * @param gameId ID de la partida
   */
  async clear(gameId: number): Promise<void> {
    await this.turnStateRedis.clearTurnTimeout(gameId);
    this.logger.log(`Timeout limpiado: gameId=${gameId}`);
  }

  /**
   * Cancela el temporizador activo para una partida sin limpiar estado en Redis.
   * @param gameId ID de la partida
   */
  cancel(gameId: number): void {
    const timeoutId = this.timeouts.get(gameId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(gameId);
      this.logger.log(`Timeout cancelado: gameId=${gameId}`);
    }
  }

  /**
   * Maneja la lógica cuando se agota el tiempo de un turno.
   * Verifica que el turno siga siendo del mismo jugador, incrementa contadores
   * de inactividad y decide si expulsar al jugador o simplemente pasar el turno.
   * @param gameId ID de la partida
   * @param currentUserId ID del usuario que tenía el turno
   * @private
   */
  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    // Verificar que el turno siga siendo del mismo jugador
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);
    if (expectedUserId !== currentUserId) return;

    // Incrementar contador de turnos perdidos
    const missedTurns = await this.turnStateRedis.incrementMissedTurns(
      gameId,
      currentUserId,
    );

    // Expulsar jugador si supera el límite de turnos perdidos
    if (missedTurns >= this.MAX_MISSED_TURNS) {
      await this.playerStateRedis.markAsAbandoned(gameId, currentUserId);

      this.gameEventEmitter.emitPlayerEliminated(gameId, currentUserId);

      this.logger.warn(
        `Jugador userId=${currentUserId} expulsado por inactividad`,
      );
      return;
    }

    // Notificar timeout y avanzar turno usando el método específico
    this.gameEventEmitter.emitTurnTimeout(gameId, currentUserId);

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Fallos=${missedTurns}`,
    );

    await this.turnOrchestrator.passTurn(gameId, currentUserId);
  }
}
