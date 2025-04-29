import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { TeamStateRedis } from '../redis/team-state.redis';
import { SocketWithUser } from '../contracts/socket.types';
import {
  parseBoard,
  getVisibleShips,
  getFormattedShots,
  getMyShipsState,
} from '../utils/board.utils';

@Injectable()
export class BoardHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  /**
   * Envía al jugador el estado del tablero:
   * - Sus barcos y los de su equipo.
   * - Todos los disparos realizados (hit y miss).
   * - Detalle completo de sus propios barcos (impactos, estado).
   * @param client Socket del jugador.
   * @param gameId ID de la partida.
   */
  async sendBoardUpdate(client: SocketWithUser, gameId: number): Promise<void> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        gamePlayers: {
          include: { user: true },
        },
      },
    });

    if (!game?.board) return;

    const board = parseBoard(game.board);
    const teams = await this.teamStateRedis.getAllTeams(gameId);

    const ships = getVisibleShips(
      board.ships,
      client.data.userId,
      teams,
      game.gamePlayers,
    );

    const shots = getFormattedShots(board.shots || []);
    const myShips = getMyShipsState(board.ships, client.data.userId);

    this.webSocketServerService
      .getServer()
      .to(client.id)
      .emit('board:update', {
        board: {
          size: board.size,
          ships,
          shots,
          myShips,
        },
      });
  }
}
