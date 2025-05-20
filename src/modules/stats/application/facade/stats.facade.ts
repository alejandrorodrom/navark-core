import { Injectable } from '@nestjs/common';
import { GameWithPlayers } from '../../../../prisma/prisma.types';
import { GeneratePlayerStatsUseCase } from '../use-cases/generate-player-stats.use-case';
import { GetUserStatsUseCase } from '../use-cases/get-user-stats.use-case';
import { GamePlayerStatsDto } from '../../domain/dto/game-player-stats.dto';
import { UserGlobalStatsDto } from '../../domain/dto/user-global-stats.dto';
import { PlayerGameHistoryDto } from '../../domain/dto/player-game-history.dto';

/**
 * Facade del módulo de estadísticas.
 *
 * Provee una interfaz única para acceder a:
 * - Generación y persistencia de estadísticas tras una partida
 * - Consultas de estadísticas acumuladas y por juego
 */
@Injectable()
export class StatsFacade {
  constructor(
    private readonly generateStats: GeneratePlayerStatsUseCase,
    private readonly getStats: GetUserStatsUseCase,
  ) {}

  /**
   * Calcula y guarda todas las estadísticas relevantes al finalizar una partida.
   *
   * @param game Partida completa con board y jugadores
   */
  async generateAndStoreStats(game: GameWithPlayers): Promise<void> {
    await this.generateStats.generateAndStoreStats(game);
  }

  /**
   * Obtiene estadísticas de todos los jugadores que participaron en una partida.
   *
   * @param gameId ID de la partida
   */
  async findGamePlayerStats(gameId: number): Promise<GamePlayerStatsDto[]> {
    return this.getStats.findGamePlayerStats(gameId);
  }

  /**
   * Consulta estadísticas acumuladas de un usuario en todo su historial.
   *
   * @param userId ID del usuario
   */
  async findUserGlobalStats(
    userId: number,
  ): Promise<UserGlobalStatsDto | null> {
    return this.getStats.findUserGlobalStats(userId);
  }

  /**
   * Retorna el historial de partidas jugadas por un usuario,
   * con sus estadísticas individuales por partida.
   *
   * @param userId ID del jugador
   */
  async findGameHistoryByUserId(
    userId: number,
  ): Promise<PlayerGameHistoryDto[]> {
    return this.getStats.findGameHistoryByUserId(userId);
  }
}
