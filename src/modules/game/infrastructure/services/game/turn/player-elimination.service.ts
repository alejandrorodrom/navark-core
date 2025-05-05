import { Injectable } from '@nestjs/common';
import { PlayerRepository } from '../../../../domain/repository/player.repository';
import { GameWithPlayers } from '../../../../../../prisma/prisma.types';
import { parseBoard } from '../../../mappers/board.mapper';

/**
 * PlayerEliminationService se encarga de identificar y marcar como eliminados
 * a los jugadores que ya no tienen barcos vivos en el tablero.
 */
@Injectable()
export class PlayerEliminationService {
  constructor(private readonly playerRepository: PlayerRepository) {}

  /**
   * Marca como eliminados a los jugadores sin barcos vivos.
   *
   * @param game Partida con jugadores y tablero.
   * @returns userIds de jugadores eliminados.
   */
  async eliminateDefeatedPlayers(game: GameWithPlayers): Promise<number[]> {
    if (!game.board) return [];

    const board = parseBoard(game.board);
    const eliminatedUserIds: number[] = [];

    for (const player of game.gamePlayers) {
      const stillHasShips = board.ships.some(
        (ship) => ship.ownerId === player.userId && !ship.isSunk,
      );

      if (!stillHasShips && !player.leftAt) {
        await this.playerRepository.markPlayerAsDefeatedById(player.id);
        eliminatedUserIds.push(player.userId);
      }
    }

    return eliminatedUserIds;
  }
}
