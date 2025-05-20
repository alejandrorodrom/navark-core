import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { PlayerStateRedis } from '../redis/player-state.redis';
import { TurnOrchestrator } from '../orchestrators/turn.orchestrator';
import { GameEventEmitter } from '../websocket/events/emitters/game-event.emitter';

/**
 * Servicio encargado de gestionar el tiempo límite por turno de cada jugador.
 *
 * Funciones:
 * - Iniciar y cancelar temporizadores
 * - Controlar turnos perdidos por inactividad
 * - Expulsar automáticamente a jugadores inactivos
 * - Pasar el turno si no actúan dentro del límite
 */
@Injectable()
export class TurnTimeoutManager {
  private readonly logger = new Logger(TurnTimeoutManager.name);

  /** Mapa en memoria de timeouts activos por partida */
  private readonly timeouts = new Map<number, NodeJS.Timeout>();

  /** Duración máxima de un turno en milisegundos (10 segundos) */
  private readonly TIMEOUT_DURATION = 10_000;

  /** Máximo número de turnos que un jugador puede perder antes de ser expulsado */
  private readonly MAX_MISSED_TURNS = 3;

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly turnOrchestrator: TurnOrchestrator,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Inicia el temporizador para el turno actual.
   *
   * Si ya existe un timeout activo para la partida, lo cancela antes de iniciar uno nuevo.
   * También registra en Redis qué jugador tiene el turno en curso.
   *
   * @param gameId ID de la partida
   * @param currentUserId ID del jugador con el turno actual
   */
  async start(gameId: number, currentUserId: number): Promise<void> {
    // Registrar en Redis quién tiene el turno actual
    await this.turnStateRedis.setTurnTimeout(gameId, currentUserId);

    // Cancelar cualquier timeout anterior que siga activo
    this.cancel(gameId);

    // Crear nuevo timeout en memoria
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
   * Elimina el registro de timeout en Redis, pero no cancela el temporizador local.
   *
   * Esto se puede usar al finalizar turnos correctamente.
   *
   * @param gameId ID de la partida
   */
  async clear(gameId: number): Promise<void> {
    await this.turnStateRedis.clearTurnTimeout(gameId);
    this.logger.log(`Timeout limpiado: gameId=${gameId}`);
  }

  /**
   * Cancela el temporizador activo en memoria para una partida.
   *
   * Esto no afecta el estado en Redis, solo detiene el callback de inactividad.
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
   * Lógica que se ejecuta cuando un jugador no realiza su acción dentro del tiempo límite.
   *
   * - Verifica si el jugador sigue teniendo el turno
   * - Aumenta el contador de fallos por inactividad
   * - Expulsa al jugador si excede el límite
   * - De lo contrario, pasa automáticamente al siguiente jugador
   *
   * @param gameId ID de la partida
   * @param currentUserId ID del jugador con el turno vencido
   */
  private async handleTimeout(
    gameId: number,
    currentUserId: number,
  ): Promise<void> {
    // Verifica que el turno aún le pertenezca a ese jugador
    const expectedUserId = await this.turnStateRedis.getTurnTimeout(gameId);
    if (expectedUserId !== currentUserId) return;

    // Incrementa el contador de turnos perdidos en Redis
    const missedTurns = await this.turnStateRedis.incrementMissedTurns(
      gameId,
      currentUserId,
    );

    // Si excedió el límite, se marca como abandonado y se expulsa
    if (missedTurns >= this.MAX_MISSED_TURNS) {
      await this.playerStateRedis.markAsAbandoned(gameId, currentUserId);

      // Notifica a todos que fue eliminado
      this.gameEventEmitter.emitPlayerEliminated(gameId, currentUserId);

      this.logger.warn(
        `Jugador userId=${currentUserId} expulsado por inactividad`,
      );
      return;
    }

    // Si aún puede continuar, se emite evento de timeout y se pasa el turno
    this.gameEventEmitter.emitTurnTimeout(gameId, currentUserId);

    this.logger.log(
      `Turno perdido para userId=${currentUserId} en gameId=${gameId}. Fallos=${missedTurns}`,
    );

    // El turno se pasa al siguiente jugador usando el orquestador
    await this.turnOrchestrator.passTurn(gameId, currentUserId);
  }
}
