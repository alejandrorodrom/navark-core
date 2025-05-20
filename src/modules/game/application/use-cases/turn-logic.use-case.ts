import { Board } from '../../domain/models/board.model';
import { GamePlayer } from '../../../../prisma/prisma.types';

/**
 * Servicio de lógica pura para el manejo de turnos.
 *
 * Este servicio no tiene dependencias externas y agrupa funciones determinísticas como:
 * - Determinar si un jugador tiene barcos vivos
 * - Calcular el siguiente jugador en turno
 * - Verificar condiciones de victoria en individual o equipos
 */
export class TurnLogicUseCase {
  /**
   * Verifica si un jugador tiene al menos un barco aún no hundido en el tablero.
   *
   * @param board Tablero actual de la partida.
   * @param userId ID del jugador a verificar.
   * @returns true si el jugador tiene al menos un barco activo.
   */
  static hasShipsAlive(board: Board, userId: number): boolean {
    return board.ships.some((ship) => ship.ownerId === userId && !ship.isSunk);
  }

  /**
   * Determina el siguiente jugador activo en base a la lista actual de jugadores vivos.
   *
   * La lista se trata como circular: si el jugador actual está al final,
   * el siguiente será el primero.
   *
   * @param aliveUserIds Lista de IDs de jugadores vivos, en orden de turno.
   * @param currentUserId ID del jugador que acaba de jugar.
   * @returns ID del siguiente jugador que debe tomar el turno.
   */
  static getNextUserId(aliveUserIds: number[], currentUserId: number): number {
    const idx = aliveUserIds.indexOf(currentUserId);

    // Si por alguna razón no se encuentra el actual, se devuelve tal cual
    if (idx === -1 || aliveUserIds.length === 0) return currentUserId;

    // Ciclo circular
    return aliveUserIds[(idx + 1) % aliveUserIds.length];
  }

  /**
   * Indica si solo queda un jugador vivo en la partida.
   *
   * Esto se usa para detectar condiciones de victoria en modo individual.
   *
   * @param aliveUserIds Lista de IDs de jugadores aún activos.
   * @returns true si solo queda uno, false si hay más.
   */
  static isOnlyOnePlayerRemaining(aliveUserIds: number[]): boolean {
    return aliveUserIds.length === 1;
  }

  /**
   * En modo equipos, determina si solo un equipo sigue en juego.
   *
   * Recorre todos los jugadores y agrupa sus equipos activos. Si hay exactamente uno,
   * significa que ese equipo ganó.
   *
   * @param gamePlayers Lista completa de GamePlayers (vivos y eliminados).
   * @returns ID del equipo que queda vivo, o null si hay más de uno.
   */
  static getSingleAliveTeam(gamePlayers: GamePlayer[]): number | null {
    const aliveTeams = new Set<number>();

    for (const p of gamePlayers) {
      // Filtra jugadores activos y con equipo asignado
      if (!p.leftAt && p.team !== null) {
        aliveTeams.add(p.team);
      }
    }

    return aliveTeams.size === 1 ? [...aliveTeams][0] : null;
  }
}
