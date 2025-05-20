import { Injectable } from '@nestjs/common';
import { GamePlayerStatsDto } from '../../domain/dto/game-player-stats.dto';
import { UserGlobalStatsDto } from '../../domain/dto/user-global-stats.dto';
import { PlayerGameHistoryDto } from '../../domain/dto/player-game-history.dto';
import { GamePlayerStatsRepository } from '../../domain/repository/game-player-stats.repository';
import { UserGlobalStatsRepository } from '../../domain/repository/user-global-stats.repository';

/**
 * Caso de uso para consultar estadísticas de usuario.
 *
 * Incluye:
 * - Estadísticas individuales de una partida (`GamePlayerStats`)
 * - Estadísticas acumuladas de un usuario (`UserGlobalStats`)
 * - Historial de partidas jugadas por el usuario
 */
@Injectable()
export class GetUserStatsUseCase {
  constructor(
    private readonly gameStatsRepo: GamePlayerStatsRepository,
    private readonly globalStatsRepo: UserGlobalStatsRepository,
  ) {}

  /**
   * Consulta estadísticas individuales de los jugadores que participaron
   * en una partida específica.
   *
   * @param gameId ID de la partida
   * @returns Lista de estadísticas por jugador
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
   * Consulta las estadísticas acumuladas de un usuario.
   *
   * @param userId ID del usuario
   * @returns Estadísticas globales o `null` si no existen
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

  /**
   * Retorna el historial de partidas jugadas por un usuario con sus estadísticas por juego.
   *
   * @param userId ID del jugador
   * @returns Lista de partidas con métricas personales
   */
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
