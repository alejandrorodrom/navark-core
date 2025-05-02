import { Injectable, Logger } from '@nestjs/common';
import { RedisUtils } from '../utils/redis.utils';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { WebSocketServerService } from './web-socket-server.service';
import { parseBoard } from '../utils/board.utils';
import { GameStatsService } from './game-stats.service';
import { GameRepository } from '../../domain/repository/game.repository';
import { PlayerRepository } from '../../domain/repository/player.repository';

@Injectable()
export class TurnManagerService {
  private readonly logger = new Logger(TurnManagerService.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly redisUtils: RedisUtils,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly webSocketServerService: WebSocketServerService,
    private readonly gameStatsService: GameStatsService,
  ) {}

  /**
   * Avanza el turno al siguiente jugador activo o finaliza la partida si corresponde.
   * También elimina automáticamente jugadores sin barcos vivos.
   *
   * @param gameId ID de la partida.
   * @param currentUserId ID del jugador que realizó la última acción.
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    const game = await this.gameRepository.findByIdWithPlayers(gameId);
    if (!game) return;

    const server = this.webSocketServerService.getServer();

    // Eliminar jugadores sin barcos vivos
    const alivePlayers: typeof game.gamePlayers = [];
    for (const player of game.gamePlayers) {
      const hasShipsAlive = await this.checkIfPlayerHasShipsAlive(
        gameId,
        player.userId,
      );
      if (!player.leftAt && hasShipsAlive) {
        alivePlayers.push(player);
      } else if (!player.leftAt && !hasShipsAlive) {
        await this.playerRepository.markPlayerAsDefeatedById(player.id);
        server.to(`game:${gameId}`).emit('player:eliminated', {
          userId: player.userId,
        });
        this.logger.log(
          `Jugador userId=${player.userId} eliminado por perder todos sus barcos.`,
        );
      }
    }

    // Finalizar partida individual
    if (alivePlayers.length === 1 && game.mode === 'individual') {
      const [winner] = alivePlayers;

      await this.playerRepository.markPlayerAsWinner(winner.id);
      await this.gameRepository.markGameAsFinished(gameId);

      await this.redisUtils.clearGameRedisState(gameId);

      const stats = await this.gameStatsService.generateStats(gameId);

      server.to(`game:${gameId}`).emit('game:ended', {
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

        await this.redisUtils.clearGameRedisState(gameId);

        const stats = await this.gameStatsService.generateStats(gameId);

        server.to(`game:${gameId}`).emit('game:ended', {
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

    const playerOrder = alivePlayers.map((p) => p.userId);
    const currentIndex = playerOrder.indexOf(currentUserId);
    const nextIndex = (currentIndex + 1) % playerOrder.length;
    const nextUserId = playerOrder[nextIndex];

    await this.turnStateRedis.setCurrentTurn(gameId, nextUserId);

    server.to(`game:${gameId}`).emit('turn:changed', {
      userId: nextUserId,
    });

    this.logger.log(
      `Turno avanzado en gameId=${gameId}. Nuevo turno para userId=${nextUserId}`,
    );
  }

  /**
   * Verifica si un jugador todavía tiene barcos vivos en el tablero global.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns true si tiene al menos un barco no hundido, false si ya no tiene barcos.
   */
  private async checkIfPlayerHasShipsAlive(
    gameId: number,
    userId: number,
  ): Promise<boolean> {
    const game = await this.gameRepository.findById(gameId);
    if (!game || !game.board) return false;

    const board = parseBoard(game.board);

    return board.ships.some((ship) => ship.ownerId === userId && !ship.isSunk);
  }
}
