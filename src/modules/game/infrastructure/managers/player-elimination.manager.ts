import { Injectable } from '@nestjs/common';
import { PlayerRepository } from '../../domain/repository/player.repository';
import { GameWithPlayers } from '../../../../prisma/prisma.types';
import { parseBoard } from '../../application/mapper/board.mapper';
import { TurnLogicUseCase } from '../../application/use-cases/turn-logic.use-case';

/**
 * Servicio que identifica y elimina a los jugadores sin barcos vivos en el tablero.
 *
 * Se ejecuta típicamente al finalizar cada turno, y su propósito es:
 * - Detectar qué jugadores han sido eliminados (sin barcos activos)
 * - Persistir su estado como "defeated"
 * - Retornar sus `userId` para que puedan ser notificados o expulsados
 */
@Injectable()
export class PlayerEliminationManager {
  constructor(private readonly playerRepository: PlayerRepository) {}

  /**
   * Evalúa y elimina a los jugadores que ya no tienen barcos vivos.
   *
   * @param game Objeto de partida que incluye jugadores y tablero (en crudo).
   * @returns Lista de userIds de jugadores eliminados en esta evaluación.
   */
  async eliminateDefeatedPlayers(game: GameWithPlayers): Promise<number[]> {
    // Si la partida no tiene un tablero cargado, no se puede procesar
    if (!game.board) return [];

    // Convertimos el tablero de tipo JSON a modelo de dominio
    const board = parseBoard(game.board);

    // Lista para acumular los IDs de usuarios eliminados
    const eliminatedUserIds: number[] = [];

    // Recorremos todos los jugadores de la partida
    for (const player of game.gamePlayers) {
      // Verificamos si aún tiene algún barco activo
      const stillHasShips = TurnLogicUseCase.hasShipsAlive(
        board,
        player.userId,
      );

      // Si no tiene barcos y no ha salido manualmente de la partida, lo eliminamos
      if (!stillHasShips && !player.leftAt) {
        await this.playerRepository.markPlayerAsDefeatedById(player.id);
        eliminatedUserIds.push(player.userId);
      }
    }

    // Retornamos los IDs eliminados para que el sistema pueda emitir eventos de notificación
    return eliminatedUserIds;
  }
}
