import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameUtils } from '../utils/game.utils';
import { SocketWithUser } from '../contracts/socket.types';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { BoardGenerationService } from '../services/board-generation.service';

@Injectable()
export class StartGameHandler {
  private readonly logger = new Logger(StartGameHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly gameUtils: GameUtils,
    private readonly webSocketServerService: WebSocketServerService,
    private readonly boardGenerationService: BoardGenerationService,
  ) {}

  /**
   * Procesa la solicitud de inicio de partida:
   * - Valída que todos los jugadores estén listos.
   * - Valída que todos los jugadores tengan equipo (si aplica).
   * - Valída que al menos un equipo tenga 2 o más jugadores.
   * - Genera un tablero único con barcos equitativos por jugador.
   * - Asigna teamId a los barcos si es en modo equipos.
   * - Actualiza el estado de la partida e inicia el primer turno.
   *
   * @param client Cliente que solicita iniciar la partida.
   * @param data Datos de la partida (gameId).
   */
  async onGameStart(
    client: SocketWithUser,
    data: { gameId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    this.logger.log(
      `Solicitud de inicio recibida. gameId=${data.gameId}, socketId=${client.id}`,
    );

    const game = await this.prismaService.game.findUnique({
      where: { id: data.gameId },
      include: { gamePlayers: true },
    });

    if (!game) {
      this.logger.warn(`Partida no encontrada. gameId=${data.gameId}`);
      client.emit('game:start:ack', {
        success: false,
        error: 'Partida no encontrada',
      });
      return;
    }

    if (game.createdById?.toString() !== client.data.userId?.toString()) {
      this.logger.warn(
        `Usuario no autorizado. userId=${client.data.userId}, gameId=${data.gameId}`,
      );
      client.emit('game:start:ack', {
        success: false,
        error: 'Solo el creador puede iniciar la partida',
      });
      return;
    }

    const readySocketIds = await this.readyStateRedis.getAllReady(data.gameId);
    const allSocketIds = this.gameUtils.getSocketsInRoom(room);
    const teams = await this.teamStateRedis.getAllTeams(data.gameId);

    const allPlayersReady = [...allSocketIds].every((id) =>
      readySocketIds.includes(id),
    );
    if (!allPlayersReady) {
      this.logger.warn(`Jugadores no listos. gameId=${data.gameId}`);
      client.emit('game:start:ack', {
        success: false,
        error: 'No todos los jugadores están listos',
      });
      return;
    }

    const allPlayersAssignedTeam = [...allSocketIds].every((id) => teams[id]);
    if (!allPlayersAssignedTeam) {
      this.logger.warn(`Jugadores sin equipo asignado. gameId=${data.gameId}`);
      client.emit('game:start:ack', {
        success: false,
        error: 'No todos los jugadores tienen equipo asignado',
      });
      return;
    }

    if (game.mode === 'teams') {
      const playerTeamCounts: Record<number, number> = {};

      for (const team of Object.values(teams)) {
        playerTeamCounts[team] = (playerTeamCounts[team] || 0) + 1;
      }

      const hasTeamWithTwoOrMore = Object.values(playerTeamCounts).some(
        (count) => count >= 2,
      );

      if (!hasTeamWithTwoOrMore) {
        this.logger.warn(
          `No hay equipos con al menos 2 jugadores. gameId=${data.gameId}`,
        );
        client.emit('game:start:ack', {
          success: false,
          error: 'Debe existir al menos un equipo con 2 o más jugadores',
        });
        return;
      }
    }

    // Generar tablero único
    const playerIds = game.gamePlayers.map((player) => player.userId);
    const { size, ships } = this.boardGenerationService.generateGlobalBoard(
      playerIds,
      game.difficulty as 'easy' | 'medium' | 'hard',
      game.mode as 'individual' | 'teams',
    );

    // Asignar teamId a barcos si es modo equipos
    if (game.mode === 'teams') {
      for (const ship of ships) {
        const playerSocketId = Object.keys(teams).find(
          (key) =>
            game.gamePlayers.find((p) => p.userId.toString() === key)
              ?.userId === ship.ownerId,
        );
        if (playerSocketId) {
          ship.teamId = teams[playerSocketId];
        }
      }
    }

    await this.prismaService.game.update({
      where: { id: data.gameId },
      data: {
        status: 'in_progress',
        board: JSON.stringify({ size, ships }),
      },
    });

    await this.turnStateRedis.setCurrentTurn(game.id, game.createdById);

    const server = this.webSocketServerService.getServer();

    server.to(room).emit('turn:changed', { userId: game.createdById });
    server.to(room).emit('game:started', { gameId: data.gameId });

    client.emit('game:start:ack', { success: true });

    this.logger.log(`Partida iniciada exitosamente. gameId=${data.gameId}`);
  }
}
