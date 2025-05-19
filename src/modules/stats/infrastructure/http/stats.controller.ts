import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { StatsQueryService } from '../../application/services/stats-query.service';
import {
  ApiTags,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiOperation,
} from '@nestjs/swagger';
import { GamePlayerStatsDto } from '../../domain/dto/game-player-stats.dto';
import { UserGlobalStatsDto } from '../../domain/dto/user-global-stats.dto';

/**
 * Controlador HTTP para exponer las estadísticas del juego.
 *
 * Incluye:
 * - Estadísticas por jugador en una partida finalizada
 * - Estadísticas acumuladas por usuario
 */
@ApiTags('Estadísticas')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsQueryService: StatsQueryService) {}

  /**
   * Retorna las estadísticas de cada jugador en una partida.
   * Usado para mostrar el resumen post-partida.
   *
   * @param gameId ID de la partida
   * @returns Lista de estadísticas individuales
   */
  @Get('games/:gameId/players')
  @ApiOperation({ summary: 'Estadísticas de jugadores en una partida' })
  @ApiParam({ name: 'gameId', type: Number })
  @ApiOkResponse({ type: [GamePlayerStatsDto] })
  async getStatsByGame(
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<GamePlayerStatsDto[]> {
    return this.statsQueryService.findGamePlayerStats(gameId);
  }

  /**
   * Retorna el resumen estadístico acumulado de un usuario.
   * Ideal para mostrar en su perfil público o privado.
   *
   * @param userId ID del usuario
   * @returns Estadísticas acumuladas o `null` si no existen
   */
  @Get('users/:userId/global')
  @ApiOperation({ summary: 'Estadísticas acumuladas de un usuario' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiOkResponse({ type: UserGlobalStatsDto })
  @ApiNotFoundResponse({ description: 'Estadísticas globales no encontradas' })
  async getUserGlobalStats(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserGlobalStatsDto | null> {
    return this.statsQueryService.findUserGlobalStats(userId);
  }
}
