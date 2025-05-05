import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../../../domain/repository/game.repository';
import { PlayerRepository } from '../../../../domain/repository/player.repository';
import { PlayerEliminationService } from './player-elimination.service';
import { RedisCleanerService } from '../cleanup/redis-cleaner.service';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';
import { parseBoard } from '../../../../domain/utils/board.utils';
import { GameStatsService } from '../../../../application/services/stats/game-stats.service';
import { TurnLogicService } from '../../../../application/services/turn/turn-logic.service';

@Injectable()
export class TurnOrchestratorService {
  private readonly logger = new Logger(TurnOrchestratorService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly gameStatsService: GameStatsService,
    private readonly playerEliminationService: PlayerEliminationService,
    private readonly redisCleaner: RedisCleanerService,
    private readonly socketServer: SocketServerAdapter,
  ) {}

  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    const game = await this.gameRepository.findByIdWithPlayers(gameId);
    if (!game || !game.board) return;

    const board = parseBoard(game.board);

    const eliminatedUserIds =
      await this.playerEliminationService.eliminateDefeatedPlayers(game);
    for (const userId of eliminatedUserIds) {
      this.socketServer.emitToGame(gameId, 'player:eliminated', { userId });
      this.logger.log(
        `Jugador userId=${userId} eliminado por perder todos sus barcos.`,
      );
    }

    const alivePlayers = game.gamePlayers.filter(
      (p) => !eliminatedUserIds.includes(p.userId) && !p.leftAt,
    );
    const aliveUserIds = alivePlayers.map((p) => p.userId);

    // Finalización en modo individual
    if (
      TurnLogicService.isOnlyOnePlayerRemaining(aliveUserIds) &&
      game.mode === 'individual'
    ) {
      const winner = alivePlayers[0];
      await this.playerRepository.markPlayerAsWinner(winner.id);
      await this.gameRepository.markGameAsFinished(gameId);
      await this.redisCleaner.clearGameRedisState(gameId);

      const stats = await this.gameStatsService.generateStats(gameId);
      this.socketServer.emitToGame(gameId, 'game:ended', {
        mode: 'individual',
        winnerUserId: winner.userId,
        stats,
      });

      this.logger.log(
        `Partida ${gameId} terminada. Ganador userId=${winner.userId}`,
      );
      return;
    }

    // Finalización por equipos
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
        this.socketServer.emitToGame(gameId, 'game:ended', {
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

    // Siguiente turno
    const nextUserId = TurnLogicService.getNextUserId(
      aliveUserIds,
      currentUserId,
    );
    this.socketServer.emitToGame(gameId, 'turn:changed', {
      userId: nextUserId,
    });

    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }
}
