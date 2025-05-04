import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { ReadyStateRedis } from '../../redis/ready-state.redis';
import { TeamStateRedis } from '../../redis/team-state.redis';
import { RoomManagerService } from '../../services/game/room-manager.service';
import { PlayerStateRedis } from '../../redis/player-state.redis';
import { PlayerJoinDto } from '../../../domain/dto/player-join.dto';
import { StateCleanerService } from '../../services/game/state-cleaner.service';
import { BoardHandler } from './board.handler';
import { GameStatus } from '../../../../../prisma/prisma.enum';
import { GameRepository } from '../../../domain/repository/game.repository';

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
    private readonly gameRepository: GameRepository,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly redisUtils: StateCleanerService,
    private readonly gameUtils: RoomManagerService,
    private readonly webSocketServerService: SocketServerAdapter,
    private readonly boardHandler: BoardHandler,
  ) {}

  /**
   * Maneja la unión de un cliente como jugador o espectador.
   * Valída duplicación, estado de la partida y restricciones por abandono.
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

    const game = await this.gameRepository.findByIdWithPlayersAndSpectator(
      data.gameId,
    );

    if (!game) {
      client.emit('join:denied', { reason: 'Partida no encontrada' });
      this.logger.warn(`Partida inexistente: gameId=${data.gameId}`);
      return;
    }

    if (data.role === 'player') {
      const isAlreadyJoined = game.gamePlayers.some(
        (p) => p.userId === client.data.userId,
      );

      if (isAlreadyJoined) {
        this.logger.log(
          `Jugador ya estaba registrado. Tratando como reconexión: userId=${client.data.userId}`,
        );

        await client.join(room);
        await this.redisUtils.saveSocketMapping(
          client.id,
          client.data.userId,
          data.gameId,
        );

        client.emit('player:joined:ack', {
          success: true,
          room,
          createdById: game.createdById,
          reconnected: true,
        });

        await this.boardHandler.sendBoardUpdate(client, data.gameId);
        return;
      }

      if (game.status !== GameStatus.waiting) {
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
      await this.redisUtils.saveSocketMapping(
        client.id,
        client.data.userId,
        data.gameId,
      );

      client.to(room).emit('player:joined', { socketId: client.id });
      client.emit('player:joined:ack', {
        success: true,
        room,
        createdById: game.createdById,
      });

      this.logger.log(
        `Jugador socketId=${client.id} unido exitosamente a room=${room}`,
      );

      if ((game.status as GameStatus) === GameStatus.in_progress) {
        await this.boardHandler.sendBoardUpdate(client, data.gameId);
      }
    }

    if (data.role === 'spectator') {
      const isAlreadySpectating = game.spectators.some(
        (s) => s.userId === client.data.userId,
      );

      if (isAlreadySpectating) {
        this.logger.log(
          `Espectador ya registrado. Reingresando sin error: userId=${client.data.userId}`,
        );

        await client.join(room);
        await this.redisUtils.saveSocketMapping(
          client.id,
          client.data.userId,
          data.gameId,
        );

        client.emit('spectator:joined:ack', {
          success: true,
          room,
          createdById: game.createdById,
          reconnected: true,
        });

        await this.boardHandler.sendBoardUpdate(client, data.gameId);
        return;
      }

      await client.join(room);

      client.emit('spectator:joined:ack', {
        success: true,
        room,
        createdById: game.createdById,
      });

      this.logger.log(
        `Espectador socketId=${client.id} unido como espectador a room=${room}`,
      );

      if (game.status === GameStatus.in_progress) {
        await this.boardHandler.sendBoardUpdate(client, data.gameId);
      }
    }
  }

  async onPlayerReady(
    client: SocketWithUser,
    data: { gameId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;

    await this.readyStateRedis.setPlayerReady(data.gameId, client.id);

    this.webSocketServerService
      .getServer()
      .to(room)
      .emit('player:ready', { socketId: client.id });

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
      this.webSocketServerService.getServer().to(room).emit('all:ready');
    }

    client.emit('player:ready:ack', { success: true });
  }

  async onPlayerChooseTeam(
    client: SocketWithUser,
    data: { gameId: number; team: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    const game = await this.gameRepository.findById(data.gameId);

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

    this.webSocketServerService
      .getServer()
      .to(room)
      .emit('player:teamAssigned', {
        socketId: client.id,
        team: data.team,
      });

    this.logger.log(
      `Jugador socketId=${client.id} asignado exitosamente al team=${data.team} en room=${room}`,
    );
  }
}
