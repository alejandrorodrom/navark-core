import { Injectable } from '@nestjs/common';
import { PlayerRepository } from '../../domain/repository/player.repository';
import { GameWithPlayers } from '../../../../prisma/prisma.types';
import { parseBoard } from '../../application/mapper/board.mapper';

/**
 * Servicio que identifica y elimina a los jugadores que ya no tienen barcos vivos.
 *
 * Este servicio se ejecuta al finalizar cada turno, y su función es:
 * - Verificar quiénes ya no tienen barcos en el tablero
 * - Marcarlos como eliminados (defeated)
 * - Devolver una lista de userIds eliminados para notificar al cliente
 */
@Injectable()
export class PlayerEliminationManager {
  constructor(private readonly playerRepository: PlayerRepository) {}

  /**
   * Marca como eliminados a los jugadores que ya no tienen barcos vivos.
   *
   * @param game Objeto de partida completo incluyendo jugadores y tablero en crudo (JSON).
   * @returns Lista de IDs de usuario que fueron eliminados en esta evaluación.
   */
  async eliminateDefeatedPlayers(game: GameWithPlayers): Promise<number[]> {
    if (!game.board) return []; // Si no hay tablero, no se puede evaluar nada

    const board = parseBoard(game.board); // Convierte el tablero crudo en modelo de dominio
    const eliminatedUserIds: number[] = [];

    for (const player of game.gamePlayers) {
      // Evalúa si el jugador tiene al menos un barco no hundido
      const stillHasShips = board.ships.some(
        (ship) => ship.ownerId === player.userId && !ship.isSunk,
      );

      // Si no tiene barcos y no ha abandonado la partida, se marca como eliminado
      if (!stillHasShips && !player.leftAt) {
        await this.playerRepository.markPlayerAsDefeatedById(player.id);
        eliminatedUserIds.push(player.userId);
      }
    }

    // Devuelve los userIds eliminados para emitir eventos al cliente
    return eliminatedUserIds;
  }
}
