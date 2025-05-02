import { Injectable } from '@nestjs/common';
import { parseBoard } from '../utils/board.utils';
import { Shot, ShotType } from '../../domain/models/shot.model';
import { PlayerStats } from '../../domain/models/stats.model';
import { GameRepository } from '../../domain/repository/game.repository';

@Injectable()
export class GameStatsService {
  constructor(private readonly gameRepository: GameRepository) {}

  async generateStats(gameId: number) {
    const game = await this.gameRepository.findByIdWithPlayers(gameId);

    if (!game || !game.board) return [];

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
        scan: 0,
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

  private calculateMaxHitStreak(shots: Shot[]) {
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
