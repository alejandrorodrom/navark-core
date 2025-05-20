import { Injectable } from '@nestjs/common';
import { GameWithPlayers } from '../../../../prisma/prisma.types';
import { GamePlayerStatsRepository } from '../../domain/repository/game-player-stats.repository';
import { UserGlobalStatsRepository } from '../../domain/repository/user-global-stats.repository';
import { StatsCalculatorLogic } from '../../domain/logic/stats-calculator.logic';

/**
 * Caso de uso responsable de calcular y guardar estadísticas
 * de una partida completada.
 */
@Injectable()
export class GeneratePlayerStatsUseCase {
  constructor(
    private readonly statsCalculator: StatsCalculatorLogic,
    private readonly gameStatsRepo: GamePlayerStatsRepository,
    private readonly userStatsRepo: UserGlobalStatsRepository,
  ) {}

  /**
   * Calcula estadísticas de cada jugador y las guarda en base de datos.
   *
   * @param game Partida finalizada con board y jugadores.
   */
  async generateAndStoreStats(game: GameWithPlayers): Promise<void> {
    const stats = this.statsCalculator.generateStatsFromGame(game);

    await this.gameStatsRepo.saveMany(game.id, stats);

    for (const stat of stats) {
      await this.userStatsRepo.upsertFromGameStats(stat);
    }
  }
}
