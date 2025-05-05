import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../../../domain/repository/game.repository';
import { PlayerRepository } from '../../../../domain/repository/player.repository';
import { PlayerEliminationService } from './player-elimination.service';
import { RedisCleanerService } from '../cleanup/redis-cleaner.service';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';
import { GameStatsService } from '../../../../application/services/stats/game-stats.service';

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
    if (!game) return;

    const eliminated =
      await this.playerEliminationService.eliminateDefeatedPlayers(game);
    for (const userId of eliminated) {
      this.socketServer.emitToGame(gameId, 'player:eliminated', {
        userId,
      });

      this.logger.log(
        `Jugador userId=${userId} eliminado por perder todos sus barcos.`,
      );
    }

    const alivePlayers = game.gamePlayers.filter(
      (p) => !eliminated.includes(p.userId) && !p.leftAt,
    );

    // Finalizar partida individual
    if (alivePlayers.length === 1 && game.mode === 'individual') {
      const [winner] = alivePlayers;
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

    // Finalizar partida por equipos
    if (game.mode === 'teams') {
      const teamsAlive = new Set(alivePlayers.map((p) => p.team));
      if (teamsAlive.size === 1) {
        const winningTeam = [...teamsAlive][0];
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

    // Avanzar al siguiente jugador
    const playerOrder = alivePlayers.map((p) => p.userId);
    const currentIndex = playerOrder.indexOf(currentUserId);
    const nextIndex = (currentIndex + 1) % playerOrder.length;
    const nextUserId = playerOrder[nextIndex];

    this.socketServer.emitToGame(gameId, 'turn:changed', {
      userId: nextUserId,
    });

    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }
}
