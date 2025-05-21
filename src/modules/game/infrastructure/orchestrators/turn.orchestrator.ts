import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../domain/repository/game.repository';
import { PlayerRepository } from '../../domain/repository/player.repository';
import { PlayerEliminationManager } from '../managers/player-elimination.manager';
import { RedisCleanerOrchestrator } from './redis-cleaner.orchestrator';
import { TurnLogicUseCase } from '../../application/use-cases/turn-logic.use-case';
import { GameEventEmitter } from '../websocket/events/emitters/game-event.emitter';
import { StatsFacade } from '../../../stats/application/facade/stats.facade';

/**
 * Servicio orquestador que controla el avance de turnos dentro de una partida.
 *
 * Responsabilidades:
 * - Eliminar jugadores sin barcos activos
 * - Detectar condiciones de victoria
 * - Finalizar la partida si corresponde
 * - Emitir eventos relevantes al frontend
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
   * Evalúa el estado de la partida tras finalizar un turno:
   * - Elimina jugadores derrotados
   * - Verifica si hay un ganador
   * - Pasa el turno al siguiente jugador si continúa la partida
   *
   * @param gameId ID de la partida
   * @param currentUserId ID del jugador que acaba de jugar
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    // 1. Obtener la partida con jugadores y tablero
    const game = await this.gameRepository.findByIdWithPlayers(gameId);

    if (!game || !game.board) {
      this.logger.warn(`Juego no encontrado o sin tablero: gameId=${gameId}`);
      return;
    }

    // 2. Eliminar jugadores sin barcos vivos
    const eliminatedUserIds =
      await this.playerEliminationService.eliminateDefeatedPlayers(game);

    // 3. Emitir eventos de eliminación por jugador
    for (const userId of eliminatedUserIds) {
      this.gameEventEmitter.emitPlayerEliminated(gameId, userId);
      this.logger.log(
        `Jugador userId=${userId} eliminado por perder todos sus barcos.`,
      );
    }

    // 4. Filtrar jugadores activos (no eliminados ni desconectados)
    const alivePlayers = game.gamePlayers.filter(
      (p) => !eliminatedUserIds.includes(p.userId) && !p.leftAt,
    );
    const aliveUserIds = alivePlayers.map((p) => p.userId);

    // 5. Si no queda ningún jugador activo, finalizar partida como abandonada
    if (aliveUserIds.length === 0) {
      this.logger.warn(
        `No quedan jugadores vivos en gameId=${gameId}. Finalizando partida.`,
      );
      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);
      this.gameEventEmitter.emitGameAbandoned(gameId);
      return;
    }

    // 6. Evaluar condición de victoria en modo individual
    if (
      TurnLogicUseCase.isOnlyOnePlayerRemaining(aliveUserIds) &&
      game.mode === 'individual'
    ) {
      const winner = alivePlayers[0];

      await this.playerRepository.markPlayerAsWinner(winner.id);
      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);

      await this.statsFacade.generateAndStoreStats(game);

      this.gameEventEmitter.emitGameEnded(gameId, {
        mode: 'individual',
        winnerUserId: winner.userId,
      });

      this.logger.log(
        `Partida ${gameId} terminada. Ganador userId=${winner.userId}`,
      );
      return;
    }

    // 7. Evaluar condición de victoria en modo por equipos
    if (game.mode === 'teams') {
      const winningTeam = TurnLogicUseCase.getSingleAliveTeam(alivePlayers);

      if (winningTeam !== null) {
        await this.playerRepository.markTeamPlayersAsWinners(
          gameId,
          winningTeam,
        );
        await this.gameRepository.markGameAsFinished(gameId);
        await this.redisCleaner.clearGameRedisState(gameId);

        await this.statsFacade.generateAndStoreStats(game);

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

    // 8. Si no se cumple condición de victoria → pasar al siguiente jugador
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
