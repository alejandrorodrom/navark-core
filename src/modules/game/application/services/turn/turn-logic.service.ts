import { Board } from '../../../domain/models/board.model';
import { GamePlayer } from '../../../../../prisma/prisma.types';

export class TurnLogicService {
  /**
   * Verifica si un jugador tiene al menos un barco no hundido en el tablero.
   *
   * @param board Tablero de juego.
   * @param userId ID del jugador a verificar.
   * @returns true si tiene barcos vivos, false si no.
   */
  static hasShipsAlive(board: Board, userId: number): boolean {
    return board.ships.some((ship) => ship.ownerId === userId && !ship.isSunk);
  }

  /**
   * Devuelve el próximo ID de jugador activo basado en el orden actual.
   *
   * @param aliveUserIds Lista de IDs de jugadores aún activos.
   * @param currentUserId ID del jugador que acaba de jugar.
   * @returns ID del siguiente jugador.
   */
  static getNextUserId(aliveUserIds: number[], currentUserId: number): number {
    const idx = aliveUserIds.indexOf(currentUserId);
    if (idx === -1 || aliveUserIds.length === 0) return currentUserId;
    return aliveUserIds[(idx + 1) % aliveUserIds.length];
  }

  /**
   * Verifica si solo queda un jugador activo.
   *
   * @param aliveUserIds Lista de IDs de jugadores aún activos.
   * @returns true si solo queda uno, false si hay más.
   */
  static isOnlyOnePlayerRemaining(aliveUserIds: number[]): boolean {
    return aliveUserIds.length === 1;
  }

  /**
   * Si solo hay un equipo con jugadores vivos, lo retorna. De lo contrario, retorna null.
   *
   * @param gamePlayers Lista completa de GamePlayers.
   * @returns ID del equipo único vivo o null si hay más de uno.
   */
  static getSingleAliveTeam(gamePlayers: GamePlayer[]): number | null {
    const aliveTeams = new Set<number>();

    for (const p of gamePlayers) {
      if (!p.leftAt && p.team !== null) {
        aliveTeams.add(p.team);
      }
    }

    return aliveTeams.size === 1 ? [...aliveTeams][0] : null;
  }
}
