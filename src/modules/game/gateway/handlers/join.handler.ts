import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { Server } from 'socket.io';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { GameUtils } from '../utils/game.utils';
import { PlayerStateRedis } from '../redis/player-state.redis';
import { PlayerJoinDto } from '../contracts/player-join.dto';

/**
 * JoinHandler gestiona la lógica relacionada con:
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
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly gameUtils: GameUtils,
    private readonly server: Server,
  ) {}

  /**
   * Maneja la unión de un cliente como jugador o espectador.
   * @param client Socket conectado.
   * @param data Datos de unión (gameId + rol).
   */
  async onPlayerJoin(
    client: SocketWithUser,
    data: PlayerJoinDto,
  ): Promise<void> {
    const room = `game:${data.gameId}`;

    this.logger.log(
      `Solicitud de unión: socketId=${client.id}, role=${data.role}, gameId=${data.gameId}`,
    );

    const game = await this.prismaService.game.findUnique({
      where: { id: data.gameId },
      include: { gamePlayers: true },
    });

    if (!game) {
      client.emit('join:denied', { reason: 'Partida no encontrada' });
      this.logger.warn(`Partida inexistente: gameId=${data.gameId}`);
      return;
    }

    if (data.role === 'player') {
      if (game.status !== 'waiting') {
        client.emit('join:denied', { reason: 'Partida ya iniciada' });
        this.logger.warn(`Intento de unirse como jugador en partida iniciada.`);
        return;
      }

      if (game.gamePlayers.length >= game.maxPlayers) {
        client.emit('join:denied', { reason: 'Partida llena' });
        this.logger.warn(`Partida llena: gameId=${data.gameId}`);
        return;
      }

      const isAbandoned = await this.playerStateRedis.isAbandoned(
        data.gameId,
        client.data.userId,
      );

      if (isAbandoned) {
        client.emit('join:denied', { reason: 'Fuiste expulsado por abandono' });
        this.logger.warn(
          `Usuario ${client.data.userId} intentó reingresar después de abandono.`,
        );
        return;
      }

      await client.join(room);

      client.to(room).emit('player:joined', { socketId: client.id });
      client.emit('player:joined:ack', {
        success: true,
        room,
        createdById: game.createdById,
      });

      this.logger.log(
        `Jugador socketId=${client.id} unido exitosamente a room=${room}`,
      );
    }

    if (data.role === 'spectator') {
      await client.join(room);

      client.emit('spectator:joined:ack', {
        success: true,
        room,
        createdById: game.createdById,
      });

      this.logger.log(
        `Espectador socketId=${client.id} unido como espectador a room=${room}`,
      );
    }
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

    this.server.to(room).emit('player:ready', { socketId: client.id });

    this.logger.log(
      `Jugador socketId=${client.id} marcado como listo en ${room}`,
    );

    const readySocketIds = await this.readyStateRedis.getAllReady(data.gameId);
    const allSocketIds = this.gameUtils.getSocketsInRoom(room);

    const allReady = [...allSocketIds].every((socketId) =>
      readySocketIds.includes(socketId),
    );

    if (allReady) {
      this.logger.log(
        `Todos los jugadores están listos en ${room}. Emitiendo 'all:ready'`,
      );
      this.server.to(room).emit('all:ready');
    }

    client.emit('player:ready:ack', { success: true });
  }

  /**
   * Permite a un jugador seleccionar su equipo en partidas por equipos.
   * Valída los límites de equipos configurados en la partida.
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
