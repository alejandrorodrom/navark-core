import { ShotType } from '../../../game/domain/models/shot.model';

/**
 * Estadísticas individuales de un jugador dentro de una partida.
 *
 * Este tipo es generado al finalizar una partida, procesando el `board`
 * y los disparos realizados por cada jugador. Puede usarse tanto para
 * persistencia (`GamePlayerStats`) como para generar estadísticas acumuladas.
 */
export type PlayerStats = {
  /**
   * ID del usuario al que pertenecen las estadísticas.
   */
  userId: number;

  /**
   * Total de disparos realizados por el jugador.
   */
  totalShots: number;

  /**
   * Cantidad de disparos que impactaron a un barco.
   */
  successfulShots: number;

  /**
   * Porcentaje de precisión (0 a 100), redondeado a dos decimales.
   */
  accuracy: number;

  /**
   * Total de barcos hundidos por este jugador.
   */
  shipsSunk: number;

  /**
   * Indica si el jugador ganó la partida.
   */
  wasWinner: boolean;

  /**
   * Cantidad de turnos que jugó (equivalente a disparos válidos).
   */
  turnsTaken: number;

  /**
   * Cantidad de barcos que le quedaban vivos al finalizar.
   */
  shipsRemaining: number;

  /**
   * Indica si fue eliminado (sin barcos vivos al final).
   */
  wasEliminated: boolean;

  /**
   * Racha máxima de impactos consecutivos.
   */
  hitStreak: number;

  /**
   * Indica si su último disparo fue un impacto.
   */
  lastShotWasHit: boolean;

  /**
   * Cantidad de disparos por tipo (simple, nuclear, etc.).
   */
  shotsByType: Record<ShotType, number>;
};
