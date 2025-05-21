import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { PlayerStateRedis } from '../redis/player-state.redis';
import { TurnOrchestrator } from '../orchestrators/turn.orchestrator';
import { GameEventEmitter } from '../websocket/events/emitters/game-event.emitter';

/**
 * Servicio encargado de gestionar el tiempo límite por turno de cada jugador.
 *
 * Funcionalidades principales:
 * - Iniciar y cancelar temporizadores por partida
 * - Llevar control de inactividad (turnos perdidos)
 * - Expulsar a jugadores por inactividad prolongada
 * - Avanzar automáticamente al siguiente turno si no se actúa a tiempo
 */
@Injectable()
export class TurnTimeoutManager {
  private readonly logger = new Logger(TurnTimeoutManager.name);

  /** Mapa en memoria con los timeouts activos por partida */
  private readonly timeouts = new Map<number, NodeJS.Timeout>();

  /** Tiempo máximo permitido por turno (en milisegundos) */
  private readonly TIMEOUT_DURATION = 10_000;

  /** Límite de turnos perdidos antes de expulsar a un jugador */
  private readonly MAX_MISSED_TURNS = 3;

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly turnOrchestrator: TurnOrchestrator,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Inicia el temporizador para un turno.
   *
   * Si ya había un timeout corriendo para la partida, se cancela y se reinicia.
   * Además, se registra en Redis quién tiene el turno actual.
   *
   * @param gameId ID de la partida
   * @param currentUserId ID del jugador con el turno actual
   */
  async start(gameId: number, currentUserId: number): Promise<void> {
    // 1. Guardar en Redis quién tiene el turno activo
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);

    // 2. Cancelar timeout anterior (si existía)
    this.cancel(gameId);

    // 3. Iniciar nuevo timeout en memoria
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
   * Limpia el estado del turno en Redis, pero no detiene el temporizador local.
   *
   * Se usa cuando un jugador ha completado su turno exitosamente.
   *
   * @param gameId ID de la partida
   */
  async clear(gameId: number): Promise<void> {
    await this.turnStateRedis.clearTurnTimeout(gameId);
    this.logger.log(`Timeout limpiado: gameId=${gameId}`);
  }

  /**
   * Cancela el temporizador en memoria para una partida.
   *
   * No afecta el estado en Redis. Útil cuando se quiere evitar
   * que el callback se dispare, por ejemplo si ya se pasó el turno manualmente.
   *
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
   * Callback ejecutado automáticamente si un jugador no responde a tiempo.
   *
   * - Verifica que el jugador aún tenga el turno
   * - Incrementa su contador de turnos perdidos
   * - Si supera el límite, lo expulsa de la partida
   * - Si no, emite evento de timeout y avanza al siguiente turno
   *
   * @param gameId ID de la partida
   * @param currentUserId ID del jugador inactivo
   */
  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    // 1. Confirmar que el turno aún pertenece al jugador esperado
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);
    if (expectedUserId !== currentUserId) return;

    // 2. Incrementar el contador de turnos perdidos
    const missedTurns = await this.turnStateRedis.incrementMissedTurns(
      gameId,
      currentUserId,
    );

    // 3. Si excede el límite de fallos → marcar como abandonado
    if (missedTurns >= this.MAX_MISSED_TURNS) {
      await this.playerStateRedis.markAsAbandoned(gameId, currentUserId);

      // Emitir evento de eliminación por inactividad
      this.gameEventEmitter.emitPlayerEliminated(gameId, currentUserId);

      this.logger.warn(
        `Jugador userId=${currentUserId} expulsado por inactividad`,
      );
      return;
    }

    // 4. Emitir evento de timeout y avanzar al siguiente jugador
    this.gameEventEmitter.emitTurnTimeout(gameId, currentUserId);

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Fallos=${missedTurns}`,
    );

    // 5. Orquestar el siguiente turno
    await this.turnOrchestrator.passTurn(gameId, currentUserId);
  }
}
