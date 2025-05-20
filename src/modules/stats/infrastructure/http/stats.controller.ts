import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StatsFacade } from '../../application/facade/stats.facade';
import { GamePlayerStatsDto } from '../../domain/dto/game-player-stats.dto';
import { UserGlobalStatsDto } from '../../domain/dto/user-global-stats.dto';
import { PlayerGameHistoryDto } from '../../domain/dto/player-game-history.dto';
import { JwtAuthGuard } from '../../../../shared/jwt/jwt-auth.guard';
import { UserId } from '../../../../shared/decorators/user-id.decorator';

/**
 * Controlador HTTP que expone los endpoints relacionados a estadísticas del usuario.
 *
 * A través de este controlador, se puede acceder a:
 * - Estadísticas por jugador en una partida (`/games/:gameId/players`)
 * - Estadísticas acumuladas de un usuario (`/users/:userId/global`)
 * - Estadísticas del usuario autenticado (`/me/global`)
 * - Historial de partidas del usuario autenticado (`/me/games`)
 */
@ApiTags('Estadísticas')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsFacade: StatsFacade) {}

  /**
   * Devuelve las estadísticas individuales de cada jugador en una partida específica.
   *
   * @param gameId ID de la partida
   * @returns Lista de `GamePlayerStatsDto` para todos los jugadores de esa partida
   */
  @Get('games/:gameId/players')
  @ApiOperation({ summary: 'Estadísticas de jugadores en una partida' })
  @ApiParam({ name: 'gameId', type: Number })
  @ApiOkResponse({ type: [GamePlayerStatsDto] })
  async getStatsByGame(
    @Param('gameId', ParseIntPipe) gameId: number,
  ): Promise<GamePlayerStatsDto[]> {
    return this.statsFacade.findGamePlayerStats(gameId);
  }

  /**
   * Retorna las estadísticas globales acumuladas de un usuario específico.
   *
   * @param userId ID del usuario del cual se desea consultar estadísticas
   * @returns `UserGlobalStatsDto` o `null` si no se encuentra información
   */
  @Get('users/:userId/global')
  @ApiOperation({ summary: 'Estadísticas acumuladas de un usuario' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiOkResponse({ type: UserGlobalStatsDto })
  @ApiNotFoundResponse({ description: 'Estadísticas globales no encontradas' })
  async getUserGlobalStats(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserGlobalStatsDto | null> {
    return this.statsFacade.findUserGlobalStats(userId);
  }

  /**
   * Retorna las estadísticas acumuladas del usuario autenticado.
   * Utilizado normalmente para el panel de perfil del jugador.
   *
   * @param userId Extraído desde el JWT mediante el decorador `@UserId()`
   * @returns Estadísticas del jugador autenticado
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/global')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Estadísticas del usuario autenticado' })
  @ApiOkResponse({ type: UserGlobalStatsDto })
  @ApiNotFoundResponse({ description: 'Estadísticas globales no encontradas' })
  async getMyStats(
    @UserId() userId: number,
  ): Promise<UserGlobalStatsDto | null> {
    return this.statsFacade.findUserGlobalStats(userId);
  }

  /**
   * Devuelve el historial de partidas jugadas por el usuario autenticado,
   * incluyendo métricas por juego como aciertos, hundimientos y victorias.
   *
   * @param userId ID del usuario autenticado
   * @returns Lista de objetos `PlayerGameHistoryDto` representando cada partida
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/games')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Historial de partidas del usuario autenticado' })
  @ApiOkResponse({ type: [PlayerGameHistoryDto] })
  async getMyGameHistory(
    @UserId() userId: number,
  ): Promise<PlayerGameHistoryDto[]> {
    return this.statsFacade.findGameHistoryByUserId(userId);
  }
}
