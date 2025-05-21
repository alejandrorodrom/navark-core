import { Board } from '../../domain/models/board.model';
import { GamePlayer } from '../../../../prisma/prisma.types';

/**
 * Servicio de lógica pura para el manejo de turnos.
 *
 * Este servicio no tiene dependencias externas y agrupa funciones determinísticas como:
 * - Determinar si un jugador tiene barcos vivos
 * - Calcular el siguiente jugador en turno
 * - Verificar condiciones de victoria en modo individual o equipos
 */
export class TurnLogicUseCase {
  /**
   * Verifica si un jugador aún tiene barcos activos (no hundidos) en el tablero.
   *
   * @param board Estado actual del tablero de juego.
   * @param userId ID del jugador a evaluar.
   * @returns `true` si tiene al menos un barco que no ha sido hundido.
   */
  static hasShipsAlive(board: Board, userId: number): boolean {
    return board.ships.some((ship) => ship.ownerId === userId && !ship.isSunk);
  }

  /**
   * Determina el siguiente jugador activo en la lista de usuarios vivos.
   *
   * El orden es circular: si el jugador actual está al final de la lista,
   * el siguiente será el primero.
   *
   * @param aliveUserIds Lista ordenada de IDs de jugadores aún en juego.
   * @param currentUserId ID del jugador que acaba de finalizar su turno.
   * @returns ID del jugador que debe tomar el siguiente turno.
   */
  static getNextUserId(aliveUserIds: number[], currentUserId: number): number {
    const idx = aliveUserIds.indexOf(currentUserId);

    if (aliveUserIds.length === 0 || !aliveUserIds.includes(currentUserId)) {
      // Por seguridad, si el jugador no está en la lista, se devuelve el mismo
      return currentUserId;
    }

    return aliveUserIds[(idx + 1) % aliveUserIds.length];
  }

  /**
   * Indica si solo queda un jugador activo en la partida.
   *
   * Esta verificación se utiliza en partidas individuales
   * para declarar al último jugador vivo como ganador.
   *
   * @param aliveUserIds Lista de IDs de jugadores vivos.
   * @returns `true` si solo queda un jugador, `false` en cualquier otro caso.
   */
  static isOnlyOnePlayerRemaining(aliveUserIds: number[]): boolean {
    return aliveUserIds.length === 1;
  }

  /**
   * Determina si solo queda un equipo con jugadores vivos.
   *
   * Esta función se usa para declarar la victoria de un equipo completo en modo "teams".
   *
   * @param gamePlayers Lista completa de jugadores de la partida.
   * @returns ID del equipo ganador si solo uno sigue activo, o `null` si hay más de uno.
   */
  static getSingleAliveTeam(gamePlayers: GamePlayer[]): number | null {
    const aliveTeams = new Set<number>();

    for (const p of gamePlayers) {
      // Considera solo jugadores activos que tienen un equipo asignado
      if (!p.leftAt && p.team !== null) {
        aliveTeams.add(p.team);
      }
    }

    return aliveTeams.size === 1 ? [...aliveTeams][0] : null;
  }
}
