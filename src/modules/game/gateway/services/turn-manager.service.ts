import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RedisUtils } from '../utils/redis.utils';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { WebSocketServerService } from './web-socket-server.service';
import { GameStatus } from '../../../../prisma/prisma.enum';

/**
 * TurnManagerService gestiona el avance de turnos y finalización de partidas.
 */
@Injectable()
export class TurnManagerService {
  private readonly logger = new Logger(TurnManagerService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisUtils: RedisUtils,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  /**
   * Avanza el turno al siguiente jugador activo o finaliza la partida si corresponde.
   * También elimina automáticamente jugadores sin barcos vivos.
   *
   * @param gameId ID de la partida.
   * @param currentUserId ID del jugador que realizó la última acción.
   */
  async passTurn(gameId: number, currentUserId: number): Promise<void> {
    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });
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
        await this.prismaService.gamePlayer.update({
          where: { id: player.id },
          data: { leftAt: new Date() },
        });
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

      await this.prismaService.gamePlayer.update({
        where: { id: winner.id },
        data: { isWinner: true },
      });
      await this.prismaService.game.update({
        where: { id: gameId },
        data: { status: GameStatus.finished },
      });

      await this.redisUtils.clearGameRedisState(gameId);

      server.to(`game:${gameId}`).emit('game:ended', {
        mode: 'individual',
        winnerUserId: winner.userId,
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

        await this.prismaService.gamePlayer.updateMany({
          where: { gameId, team: winningTeam },
          data: { isWinner: true },
        });
        await this.prismaService.game.update({
          where: { id: gameId },
          data: { status: GameStatus.finished },
        });

        await this.redisUtils.clearGameRedisState(gameId);

        server.to(`game:${gameId}`).emit('game:ended', {
          mode: 'teams',
          winningTeam,
        });

        this.logger.log(
          `Partida ${gameId} terminada. Equipo ganador=${winningTeam}`,
        );
        return;
      }
    }

    // Avanzar turno
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
    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
    });
    if (!game || !game.board) return false;

    const board = JSON.parse(game.board as unknown as string) as {
      ships: Array<{
        ownerId: number;
        isSunk: boolean;
      }>;
    };

    return board.ships.some((ship) => ship.ownerId === userId && !ship.isSunk);
  }
}
