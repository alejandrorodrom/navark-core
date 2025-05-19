import { Injectable } from '@nestjs/common';
import { StatsService } from '../services/stats.service';
import { GamePlayerStatsRepository } from '../../domain/repository/game-player-stats.repository';
import { UserGlobalStatsRepository } from '../../domain/repository/user-global-stats.repository';
import { GameWithPlayers } from '../../../../prisma/prisma.types';

/**
 * Facade del módulo de estadísticas.
 *
 * Coordina el flujo completo al finalizar una partida:
 * - Cálculo de estadísticas individuales
 * - Guardado de estadísticas por jugador en la partida (`GamePlayerStats`)
 * - Actualización de estadísticas acumuladas por usuario (`UserGlobalStats`)
 */
@Injectable()
export class StatsFacade {
  constructor(
    private readonly statsService: StatsService,
    private readonly gamePlayerStatsRepository: GamePlayerStatsRepository,
    private readonly userGlobalStatsRepository: UserGlobalStatsRepository,
  ) {}

  /**
   * Calcula y persiste las estadísticas completas de una partida finalizada.
   *
   * Este método se debe llamar al finalizar una partida, ya que gestiona
   * todo el ciclo de generación y persistencia de estadísticas.
   *
   * @param game Objeto de la partida (`GameWithPlayers`) que incluye el board final y los jugadores
   */
  async generateAndStoreStats(game: GameWithPlayers): Promise<void> {
    const stats = this.statsService.generateStatsFromGame(game);

    await this.gamePlayerStatsRepository.saveMany(game.id, stats);

    for (const stat of stats) {
      await this.userGlobalStatsRepository.upsertFromGameStats(stat);
    }
  }
}
