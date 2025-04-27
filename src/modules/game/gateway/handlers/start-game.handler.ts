import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameUtils } from '../utils/game.utils';
import { SocketWithUser } from '../contracts/socket.types';
import { Server } from 'socket.io';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { TurnStateRedis } from '../redis/turn-state.redis';

/**
 * StartGameHandler maneja la validación y el inicio de partidas multijugador.
 * Se asegura de que todos los jugadores estén listos y correctamente organizados antes de comenzar.
 */
@Injectable()
export class StartGameHandler {
  private readonly logger = new Logger(StartGameHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly gameUtils: GameUtils,
    private readonly server: Server,
  ) {}

  /**
   * Procesa la solicitud de inicio de partida, validando todos los requisitos:
   * - Todos los jugadores deben estar listos.
   * - Todos los jugadores deben tener un equipo asignado si aplica.
   * - Todos los equipos requeridos deben tener al menos un jugador.
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
        `Usuario no autorizado a iniciar partida. userId=${client.data.userId}, gameId=${data.gameId}`,
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

    // Validar que todos estén listos
    const allPlayersReady = [...allSocketIds].every((id) =>
      readySocketIds.includes(id),
    );
    if (!allPlayersReady) {
      this.logger.warn(`Jugadores no listos detectados. gameId=${data.gameId}`);
      client.emit('game:start:ack', {
        success: false,
        error: 'No todos los jugadores están listos',
      });
      return;
    }

    // Validar asignación de equipos
    const allPlayersAssignedTeam = [...allSocketIds].every((id) => teams[id]);
    if (!allPlayersAssignedTeam) {
      this.logger.warn(`Jugadores sin equipo asignado. gameId=${data.gameId}`);
      client.emit('game:start:ack', {
        success: false,
        error: 'No todos los jugadores tienen equipo asignado',
      });
      return;
    }

    // Validar que cada equipo requerido tenga jugadores
    const teamCounts: Record<number, number> = {};
    for (const team of Object.values(teams)) {
      teamCounts[team] = (teamCounts[team] || 0) + 1;
    }

    for (let i = 1; i <= (game.teamCount ?? 0); i++) {
      if (!teamCounts[i]) {
        this.logger.warn(`Equipo ${i} está vacío. gameId=${data.gameId}`);
        client.emit('game:start:ack', {
          success: false,
          error: `El equipo ${i} no tiene jugadores asignados`,
        });
        return;
      }
    }

    // Actualizar estado de la partida
    await this.prismaService.game.update({
      where: { id: data.gameId },
      data: { status: 'in_progress' },
    });

    // Inicializar primer turno
    await this.turnStateRedis.setCurrentTurn(game.id, game.createdById);

    this.server.to(room).emit('turn:changed', {
      userId: game.createdById,
    });

    this.server.to(room).emit('game:started', { gameId: data.gameId });
    client.emit('game:start:ack', { success: true });

    this.logger.log(`Partida iniciada exitosamente. gameId=${data.gameId}`);
  }
}
