import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../../../domain/repository/game.repository';
import { PlayerRepository } from '../../../../domain/repository/player.repository';
import { PlayerEliminationService } from './player-elimination.service';
import { RedisCleanerService } from '../cleanup/redis-cleaner.service';
import { GameStatsService } from '../../../../application/services/stats/game-stats.service';
import { TurnLogicService } from '../../../../application/services/turn/turn-logic.service';
import { GameEventEmitter } from '../../../websocket/events/emitters/game-event.emitter';

/**
 * Servicio orquestador del sistema de turnos en las partidas.
 * Coordina el flujo de turnos, eliminación de jugadores y finalización del juego.
 */
@Injectable()
export class TurnOrchestratorService {
  /** Logger específico para el orquestador de turnos */
  private readonly logger = new Logger(TurnOrchestratorService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly gameStatsService: GameStatsService,
    private readonly playerEliminationService: PlayerEliminationService,
    private readonly redisCleaner: RedisCleanerService,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Gestiona el avance del turno al siguiente jugador, verificando posibles eliminaciones
   * y comprobando las condiciones de finalización del juego.
   * @param gameId Identificador de la partida
   * @param currentUserId ID del usuario que termina su turno
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    const game = await this.gameRepository.findByIdWithPlayers(gameId);
    if (!game || !game.board) {
      this.logger.warn(`Juego no encontrado o sin tablero: gameId=${gameId}`);
      return;
    }

    // Eliminar jugadores que han perdido todos sus barcos
    const eliminatedUserIds =
      await this.playerEliminationService.eliminateDefeatedPlayers(game);

    // Notificar jugadores eliminados
    for (const userId of eliminatedUserIds) {
      this.gameEventEmitter.emitPlayerEliminated(gameId, userId);
      this.logger.log(
        `Jugador userId=${userId} eliminado por perder todos sus barcos.`,
      );
    }

    const alivePlayers = game.gamePlayers.filter(
      (p) => !eliminatedUserIds.includes(p.userId) && !p.leftAt,
    );
    const aliveUserIds = alivePlayers.map((p) => p.userId);

    // Si no quedan jugadores vivos, finalizar la partida como abandonada
    if (aliveUserIds.length === 0) {
      this.logger.warn(
        `No quedan jugadores vivos en gameId=${gameId}. Finalizando partida.`,
      );

      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);

      this.gameEventEmitter.emitGameAbandoned(gameId);
      return;
    }

    // Verificar condición de victoria en modo individual
    if (
      TurnLogicService.isOnlyOnePlayerRemaining(aliveUserIds) &&
      game.mode === 'individual'
    ) {
      const winner = alivePlayers[0];
      await this.playerRepository.markPlayerAsWinner(winner.id);
      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);

      const stats = await this.gameStatsService.generateStats(gameId);
      this.gameEventEmitter.emitGameEnded(gameId, {
        mode: 'individual',
        winnerUserId: winner.userId,
        stats,
      });

      this.logger.log(
        `Partida ${gameId} terminada. Ganador userId=${winner.userId}`,
      );
      return;
    }

    // Verificar condición de victoria en modo equipos
    if (game.mode === 'teams') {
      const winningTeam = TurnLogicService.getSingleAliveTeam(alivePlayers);
      if (winningTeam !== null) {
        await this.playerRepository.markTeamPlayersAsWinners(
          gameId,
          winningTeam,
        );
        await this.gameRepository.markGameAsFinished(gameId);
        await this.redisCleaner.clearGameRedisState(gameId);

        const stats = await this.gameStatsService.generateStats(gameId);
        this.gameEventEmitter.emitGameEnded(gameId, {
          mode: 'teams',
          winningTeam,
          stats,
        });

        this.logger.log(
          `Partida ${gameId} terminada. Equipo ganador=${winningTeam}`,
        );
        return;
      }
    }

    // Pasar al siguiente turno si el juego continúa
    const nextUserId = TurnLogicService.getNextUserId(
      aliveUserIds,
      currentUserId,
    );

    this.gameEventEmitter.emitTurnChanged(gameId, nextUserId);
    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }
}
