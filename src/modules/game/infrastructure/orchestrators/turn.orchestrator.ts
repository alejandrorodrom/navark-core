import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../domain/repository/game.repository';
import { PlayerRepository } from '../../domain/repository/player.repository';
import { PlayerEliminationManager } from '../managers/player-elimination.manager';
import { RedisCleanerOrchestrator } from './redis-cleaner.orchestrator';
import { TurnLogicUseCase } from '../../application/use-cases/turn-logic.use-case';
import { GameEventEmitter } from '../websocket/events/emitters/game-event.emitter';
import { StatsFacade } from '../../../stats/application/facade/stats.facade';

/**
 * Servicio orquestador del sistema de turnos en las partidas.
 *
 * - Coordina eliminación de jugadores derrotados
 * - Determina si hay un ganador (modo individual o equipos)
 * - Finaliza la partida si corresponde
 * - Emite eventos al frontend vía WebSocket
 */
@Injectable()
export class TurnOrchestrator {
  private readonly logger = new Logger(TurnOrchestrator.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly statsFacade: StatsFacade,
    private readonly playerEliminationService: PlayerEliminationManager,
    private readonly redisCleaner: RedisCleanerOrchestrator,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Avanza el turno al siguiente jugador o finaliza la partida si se cumple una condición de victoria.
   *
   * @param gameId ID de la partida en curso
   * @param currentUserId ID del jugador que acaba de realizar su acción
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    // Obtiene el estado actual de la partida y sus jugadores
    const game = await this.gameRepository.findByIdWithPlayers(gameId);

    if (!game || !game.board) {
      this.logger.warn(`Juego no encontrado o sin tablero: gameId=${gameId}`);
      return;
    }

    // Elimina del juego a los jugadores que ya no tienen barcos vivos
    const eliminatedUserIds =
      await this.playerEliminationService.eliminateDefeatedPlayers(game);

    // Emite un evento por cada jugador eliminado
    for (const userId of eliminatedUserIds) {
      this.gameEventEmitter.emitPlayerEliminated(gameId, userId);
      this.logger.log(
        `Jugador userId=${userId} eliminado por perder todos sus barcos.`,
      );
    }

    // Filtra los jugadores que siguen activos (no eliminados ni desconectados)
    const alivePlayers = game.gamePlayers.filter(
      (p) => !eliminatedUserIds.includes(p.userId) && !p.leftAt,
    );
    const aliveUserIds = alivePlayers.map((p) => p.userId);

    // Si no queda nadie vivo, se considera partida abandonada
    if (aliveUserIds.length === 0) {
      this.logger.warn(
        `No quedan jugadores vivos en gameId=${gameId}. Finalizando partida.`,
      );

      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);
      this.gameEventEmitter.emitGameAbandoned(gameId);
      return;
    }

    // Verifica si queda solo un jugador y el modo es individual
    if (
      TurnLogicUseCase.isOnlyOnePlayerRemaining(aliveUserIds) &&
      game.mode === 'individual'
    ) {
      const winner = alivePlayers[0];

      // Marca como ganador al jugador sobreviviente
      await this.playerRepository.markPlayerAsWinner(winner.id);
      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);

      // Calcula y guarda estadísticas de la partida finalizada
      await this.statsFacade.generateAndStoreStats(game);

      // Emite evento de fin de partida con el ganador
      this.gameEventEmitter.emitGameEnded(gameId, {
        mode: 'individual',
        winnerUserId: winner.userId,
      });

      this.logger.log(
        `Partida ${gameId} terminada. Ganador userId=${winner.userId}`,
      );
      return;
    }

    // Si el modo de juego es por equipos, verifica si solo queda un equipo vivo
    if (game.mode === 'teams') {
      const winningTeam = TurnLogicUseCase.getSingleAliveTeam(alivePlayers);

      if (winningTeam !== null) {
        // Marca a todos los jugadores del equipo como ganadores
        await this.playerRepository.markTeamPlayersAsWinners(
          gameId,
          winningTeam,
        );
        await this.gameRepository.markGameAsFinished(gameId);
        await this.redisCleaner.clearGameRedisState(gameId);

        await this.statsFacade.generateAndStoreStats(game);

        // Emite evento indicando el equipo ganador
        this.gameEventEmitter.emitGameEnded(gameId, {
          mode: 'teams',
          winningTeam,
        });

        this.logger.log(
          `Partida ${gameId} terminada. Equipo ganador=${winningTeam}`,
        );
        return;
      }
    }

    // Si no hay condiciones de victoria, simplemente pasa el turno al siguiente jugador
    const nextUserId = TurnLogicUseCase.getNextUserId(
      aliveUserIds,
      currentUserId,
    );

    this.gameEventEmitter.emitTurnChanged(gameId, nextUserId);
    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }
}
