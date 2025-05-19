import { Injectable } from '@nestjs/common';
import { Shot, ShotType } from '../../../game/domain/models/shot.model';
import { PlayerStats } from '../../domain/models/stats.model';
import { parseBoard } from '../../../game/infrastructure/mappers/board.mapper';
import { GameWithPlayers } from '../../../../prisma/prisma.types';

/**
 * Servicio de lógica pura encargado de calcular estadísticas
 * por jugador a partir del estado final de una partida.
 *
 * No tiene acceso a la base de datos ni depende de otros servicios,
 * solo transforma el tablero final (`board`) y los jugadores
 * en un arreglo de estadísticas individuales.
 */
@Injectable()
export class StatsService {
  /**
   * Calcula las estadísticas de cada jugador a partir de los datos de la partida.
   *
   * Este método espera que el `board` ya esté completamente actualizado y
   * que los `gamePlayers` contengan los campos `userId`, `isWinner` y `leftAt`.
   *
   * @param game Objeto de partida que incluye el `board` final y los jugadores.
   * @returns Arreglo de estadísticas individuales (`PlayerStats[]`)
   *
   * @example
   * const stats = statsService.generateStatsFromGame(game);
   */
  generateStatsFromGame(game: GameWithPlayers): PlayerStats[] {
    if (!game.board) return [];

    const board = parseBoard(game.board);
    const playerStats = new Map<number, PlayerStats>();

    for (const player of game.gamePlayers) {
      const playerShots = board.shots.filter(
        (s) => s.shooterId === player.userId,
      );
      const hits = playerShots.filter((s) => s.hit);
      const lastShot = playerShots[playerShots.length - 1];

      const shipsRemaining = board.ships.filter(
        (ship) => ship.ownerId === player.userId && !ship.isSunk,
      ).length;

      const wasEliminated = shipsRemaining === 0;
      const hitStreak = this.calculateMaxHitStreak(playerShots);

      const sunkShipIds = new Set(
        playerShots
          .filter((s) => s.sunkShipId !== undefined)
          .map((s) => s.sunkShipId),
      );

      const shotsByType: Record<ShotType, number> = {
        simple: 0,
        cross: 0,
        multi: 0,
        area: 0,
        nuclear: 0,
      };
      for (const shot of playerShots) {
        shotsByType[shot.type] += 1;
      }

      playerStats.set(player.userId, {
        userId: player.userId,
        totalShots: playerShots.length,
        successfulShots: hits.length,
        accuracy: playerShots.length
          ? +((hits.length / playerShots.length) * 100).toFixed(2)
          : 0,
        shipsSunk: sunkShipIds.size,
        wasWinner: player.isWinner,
        turnsTaken: playerShots.length,
        shipsRemaining,
        wasEliminated,
        hitStreak,
        lastShotWasHit: lastShot ? lastShot.hit : false,
        shotsByType,
      });
    }

    return Array.from(playerStats.values());
  }

  private calculateMaxHitStreak(shots: Shot[]): number {
    let max = 0;
    let current = 0;
    for (const shot of shots) {
      if (shot.hit) {
        current += 1;
        if (current > max) max = current;
      } else {
        current = 0;
      }
    }
    return max;
  }
}
