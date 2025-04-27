import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { Server } from 'socket.io';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';

/**
 * JoinHandler gestiona la lógica relacionada a:
 * - Unirse a una partida.
 * - Marcarse como listo.
 * - Seleccionar equipo (modo por equipos).
 */
@Injectable()
export class JoinHandler {
  private readonly logger = new Logger(JoinHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly server: Server,
  ) {}

  /**
   * Maneja la unión de un jugador a una partida.
   * Emite un evento de confirmación de unión y proporciona el creador actual.
   *
   * @param client Cliente que se une.
   * @param data Contiene el ID de la partida (`gameId`).
   */
  async onPlayerJoin(
    client: SocketWithUser,
    data: { gameId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    await client.join(room);

    const game = await this.prismaService.game.findUnique({
      where: { id: data.gameId },
      select: { createdById: true },
    });

    client.to(room).emit('player:joined', { socketId: client.id });
    client.emit('player:joined:ack', {
      success: true,
      room,
      createdById: game?.createdById ?? null,
    });

    this.logger.log(
      `Jugador socketId=${client.id} se unió a room=${room}`,
    );
  }

  /**
   * Marca al jugador como listo dentro de la partida.
   * Emite un evento de confirmación y actualiza estado en Redis.
   *
   * @param client Cliente que se marca como listo.
   * @param data Contiene el ID de la partida (`gameId`).
   */
  async onPlayerReady(
    client: SocketWithUser,
    data: { gameId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    await this.readyStateRedis.setPlayerReady(data.gameId, client.id);

    client.to(room).emit('player:ready', { socketId: client.id });
    client.emit('player:ready:ack', { success: true });

    this.logger.log(
      `Jugador socketId=${client.id} marcado como listo en room=${room}`,
    );
  }

  /**
   * Permite a un jugador seleccionar su equipo en partidas por equipos.
   * Valida los límites de equipos configurados en la partida.
   *
   * @param client Cliente que selecciona un equipo.
   * @param data Contiene `gameId` y `team` seleccionado.
   */
  async onPlayerChooseTeam(
    client: SocketWithUser,
    data: { gameId: number; team: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    const game = await this.prismaService.game.findUnique({
      where: { id: data.gameId },
    });

    if (!game) {
      this.logger.warn(
        `Intento de seleccionar equipo en partida inexistente: gameId=${data.gameId}`,
      );
      client.emit('player:chooseTeam:ack', {
        success: false,
        error: 'Partida no encontrada',
      });
      return;
    }

    if (game.mode !== 'teams' || !game.teamCount) {
      this.logger.warn(
        `Selección de equipo inválida: partida gameId=${data.gameId} no permite equipos`,
      );
      client.emit('player:chooseTeam:ack', {
        success: false,
        error: 'La partida no permite selección de equipos',
      });
      return;
    }

    if (data.team < 1 || data.team > game.teamCount) {
      this.logger.warn(
        `Número de equipo fuera de rango: solicitado team=${data.team} en gameId=${data.gameId}`,
      );
      client.emit('player:chooseTeam:ack', {
        success: false,
        error: 'Número de equipo inválido',
      });
      return;
    }

    await this.teamStateRedis.setPlayerTeam(data.gameId, client.id, data.team);

    client.emit('player:chooseTeam:ack', { success: true });
    this.server.to(room).emit('player:teamAssigned', {
      socketId: client.id,
      team: data.team,
    });

    this.logger.log(
      `Jugador socketId=${client.id} asignado exitosamente al team=${data.team} en room=${room}`,
    );
  }
}
