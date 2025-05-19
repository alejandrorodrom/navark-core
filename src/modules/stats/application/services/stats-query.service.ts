import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GamePlayerStatsDto } from '../../domain/dto/game-player-stats.dto';
import { UserGlobalStatsDto } from '../../domain/dto/user-global-stats.dto';
import { UserGlobalStatsRepository } from '../../domain/repository/user-global-stats.repository';
import { GamePlayerStatsRepository } from '../../domain/repository/game-player-stats.repository';
import { PlayerGameHistoryDto } from '../../domain/dto/player-game-history.dto';

/**
 * Servicio de solo lectura que expone estadísticas
 * por partida y por usuario desde la base de datos.
 */
@Injectable()
export class StatsQueryService {
  constructor(
    private readonly gameStatsRepo: GamePlayerStatsRepository,
    private readonly globalStatsRepo: UserGlobalStatsRepository,
  ) {}

  /**
   * Devuelve las estadísticas por jugador de una partida específica.
   * @param gameId ID de la partida
   */
  async findGamePlayerStats(gameId: number): Promise<GamePlayerStatsDto[]> {
    const stats = await this.gameStatsRepo.findByGameId(gameId);

    return stats.map((s) => ({
      userId: s.userId,
      nickname: s.user.nickname,
      totalShots: s.totalShots,
      successfulShots: s.successfulShots,
      accuracy: s.accuracy,
      shipsSunk: s.shipsSunk,
      wasWinner: s.wasWinner,
      turnsTaken: s.turnsTaken,
      shipsRemaining: s.shipsRemaining,
      wasEliminated: s.wasEliminated,
      hitStreak: s.hitStreak,
      lastShotWasHit: s.lastShotWasHit,
    }));
  }

  /**
   * Devuelve las estadísticas acumuladas de un usuario.
   * @param userId ID del usuario
   */
  async findUserGlobalStats(
    userId: number,
  ): Promise<UserGlobalStatsDto | null> {
    const stats = await this.globalStatsRepo.findByUserId(userId);

    if (!stats) return null;

    return {
      userId: stats.userId,
      gamesPlayed: stats.gamesPlayed,
      gamesWon: stats.gamesWon,
      totalShots: stats.totalShots,
      successfulShots: stats.successfulShots,
      accuracy: stats.accuracy,
      shipsSunk: stats.shipsSunk,
      totalTurnsTaken: stats.totalTurnsTaken,
      maxHitStreak: stats.maxHitStreak,
      nuclearUsed: stats.nuclearUsed,
      lastGameAt: stats.lastGameAt,
    };
  }

  async findGameHistoryByUserId(
    userId: number,
  ): Promise<PlayerGameHistoryDto[]> {
    const stats = await this.gameStatsRepo.findByUserIdWithGame(userId);

    return stats.map((s) => ({
      gameId: s.gameId,
      gameMode: s.game.mode,
      playedAt: s.createdAt,

      wasWinner: s.wasWinner,
      totalShots: s.totalShots,
      successfulShots: s.successfulShots,
      accuracy: s.accuracy,
      shipsSunk: s.shipsSunk,
      hitStreak: s.hitStreak,
    }));
  }
}
