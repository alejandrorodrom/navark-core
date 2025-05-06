import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { GameEvents } from '../events/constants/game-events.enum';
import { EventPayload } from '../events/types/events-payload.type';
import { ReadyStateRedis } from '../../redis/ready-state.redis';
import { TeamStateRedis } from '../../redis/team-state.redis';
import { PlayerStateRedis } from '../../redis/player-state.redis';
import { BoardHandler } from './board.handler';
import { GameStatus } from '../../../../../prisma/prisma.enum';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameSocketMapRedisRepository } from '../../repository/redis/game-socket-map.redis.repository';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';

/**
 * JoinHandler gestiona la lógica relacionada con:
 * - Unirse a una partida.
 * - Marcarse como listo.
 * - Seleccionar equipo (modo por equipos).
 *
 * Utiliza el sistema de eventos tipados para garantizar la integridad de los mensajes.
 */
@Injectable()
export class JoinHandler {
  private readonly logger = new Logger(JoinHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly boardHandler: BoardHandler,
    private readonly gameSocketMapRedisRepository: GameSocketMapRedisRepository,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Maneja la unión de un cliente como jugador o espectador a una partida.
   *
   * Realiza las siguientes validaciones:
   * - Existencia de la partida
   * - Permisos de unión (partida iniciada, llena, abandono previo)
   * - Reconexión de jugadores existentes
   *
   * Registra al jugador o espectador en la sala correspondiente y envía
   * las confirmaciones y estados necesarios al cliente.
   *
   * @param client Socket conectado con información del usuario autenticado
   * @param data Información de unión a la partida con ID y rol (jugador/espectador)
   */
  async onPlayerJoin(
    client: SocketWithUser,
    data: EventPayload<GameEvents.PLAYER_JOIN>,
  ): Promise<void> {
    const room = `game:${data.gameId}`;

    this.logger.log(
      `Solicitud de unión: socketId=${client.id}, role=${data.role}, gameId=${data.gameId}`,
    );

    try {
      // Obtener datos de la partida incluyendo jugadores y espectadores
      const game = await this.gameRepository.findByIdWithPlayersAndSpectator(
        data.gameId,
      );

      // Validar que la partida exista
      if (!game) {
        this.gameEventEmitter.emitToClient(client.id, GameEvents.JOIN_DENIED, {
          reason: 'Partida no encontrada',
        });
        this.logger.warn(`Partida inexistente: gameId=${data.gameId}`);
        return;
      }

      // Lógica específica para rol de jugador
      if (data.role === 'player') {
        // Verificar si el jugador ya estaba registrado en la partida (reconexión)
        const isAlreadyJoined = game.gamePlayers.some(
          (p) => p.userId === client.data.userId,
        );

        if (isAlreadyJoined) {
          this.logger.log(
            `Jugador ya estaba registrado. Tratando como reconexión: userId=${client.data.userId}`,
          );

          // Procesar como reconexión usando el adaptador
          await this.socketServerAdapter.joinGameRoom(client.id, data.gameId);
          await this.gameSocketMapRedisRepository.save(
            client.id,
            client.data.userId,
            data.gameId,
          );

          // Enviar confirmación de reconexión
          this.gameEventEmitter.emitPlayerJoinedAck(client.id, {
            success: true,
            room,
            createdById: game.createdById,
            reconnected: true,
          });

          // Enviar actualización del tablero si corresponde
          await this.boardHandler.sendBoardUpdate(client, data.gameId);
          return;
        }

        // Validar que la partida permita nuevos jugadores
        if (game.status !== GameStatus.waiting) {
          this.gameEventEmitter.emitToClient(
            client.id,
            GameEvents.JOIN_DENIED,
            {
              reason: 'Partida ya iniciada',
            },
          );
          this.logger.warn(
            `Intento de unirse como jugador en partida iniciada.`,
          );
          return;
        }

        // Validar que la partida no esté llena
        if (game.gamePlayers.length >= game.maxPlayers) {
          this.gameEventEmitter.emitToClient(
            client.id,
            GameEvents.JOIN_DENIED,
            {
              reason: 'Partida llena',
            },
          );
          this.logger.warn(`Partida llena: gameId=${data.gameId}`);
          return;
        }

        // Validar que el jugador no haya abandonado previamente la partida
        const isAbandoned = await this.playerStateRedis.isAbandoned(
          data.gameId,
          client.data.userId,
        );
        if (isAbandoned) {
          this.gameEventEmitter.emitToClient(
            client.id,
            GameEvents.JOIN_DENIED,
            {
              reason: 'Fuiste expulsado por abandono',
            },
          );
          this.logger.warn(
            `Usuario ${client.data.userId} intentó reingresar después de abandono.`,
          );
          return;
        }

        // Registrar al jugador en la sala usando el adaptador
        await this.socketServerAdapter.joinGameRoom(client.id, data.gameId);
        await this.gameSocketMapRedisRepository.save(
          client.id,
          client.data.userId,
          data.gameId,
        );

        // Notificar a todos y confirmar unión
        this.gameEventEmitter.emitPlayerJoined(data.gameId, client.id);
        this.gameEventEmitter.emitPlayerJoinedAck(client.id, {
          success: true,
          room,
          createdById: game.createdById,
        });

        this.logger.log(
          `Jugador socketId=${client.id} unido exitosamente a room=${room}`,
        );

        // Enviar actualización del tablero si la partida está en curso
        if ((game.status as GameStatus) === GameStatus.in_progress) {
          await this.boardHandler.sendBoardUpdate(client, data.gameId);
        }
      }

      // Lógica específica para rol de espectador
      if (data.role === 'spectator') {
        // Verificar si ya estaba registrado como espectador
        const isAlreadySpectating = game.spectators.some(
          (s) => s.userId === client.data.userId,
        );

        if (isAlreadySpectating) {
          this.logger.log(
            `Espectador ya registrado. Reingresando sin error: userId=${client.data.userId}`,
          );

          // Procesar reingreso de espectador usando el adaptador
          await this.socketServerAdapter.joinGameRoom(client.id, data.gameId);
          await this.gameSocketMapRedisRepository.save(
            client.id,
            client.data.userId,
            data.gameId,
          );

          // Enviar confirmación de reconexión
          this.gameEventEmitter.emitSpectatorJoinedAck(client.id, {
            success: true,
            room,
            createdById: game.createdById,
            reconnected: true,
          });

          // Enviar actualización del tablero
          await this.boardHandler.sendBoardUpdate(client, data.gameId);
          return;
        }

        // Registrar al nuevo espectador usando el adaptador
        await this.socketServerAdapter.joinGameRoom(client.id, data.gameId);
        await this.gameSocketMapRedisRepository.save(
          client.id,
          client.data.userId,
          data.gameId,
        );

        // Confirmar registro como espectador
        this.gameEventEmitter.emitSpectatorJoinedAck(client.id, {
          success: true,
          room,
          createdById: game.createdById,
        });

        this.logger.log(
          `Espectador socketId=${client.id} unido como espectador a room=${room}`,
        );

        // Enviar actualización del tablero si la partida está en curso
        if (game.status === GameStatus.in_progress) {
          await this.boardHandler.sendBoardUpdate(client, data.gameId);
        }
      }
    } catch (error) {
      this.logger.error(`Error procesando solicitud de unión: ${error}`);
      this.gameEventEmitter.emitToClient(client.id, GameEvents.JOIN_DENIED, {
        reason: 'Error interno al procesar la solicitud',
      });
    }
  }

  /**
   * Procesa cuando un jugador marca que está listo para iniciar la partida.
   *
   * Acciones:
   * - Registra el estado "listo" del jugador en Redis
   * - Notifica a todos los jugadores en la sala
   * - Verifica si todos los jugadores están listos para empezar
   * - Emite el evento "all:ready" cuando todos están preparados
   *
   * @param client Socket conectado con información del usuario autenticado
   * @param data Información con el ID de la partida
   */
  async onPlayerReady(
    client: SocketWithUser,
    data: EventPayload<GameEvents.PLAYER_READY>,
  ): Promise<void> {
    const gameId = data.gameId;
    const room = `game:${gameId}`;

    try {
      this.logger.log(
        `Jugador socketId=${client.id} marcado como listo en ${room}`,
      );

      // Registrar jugador como listo en Redis
      await this.readyStateRedis.setPlayerReady(gameId, client.id);

      // Notificar a todos los jugadores que este jugador está listo
      this.gameEventEmitter.emitPlayerReadyNotify(gameId, client.id);

      // Verificar si todos los jugadores están listos
      const readySocketIds = await this.readyStateRedis.getAllReady(gameId);
      const allSocketIds = this.socketServerAdapter.getSocketsInGame(gameId);

      const allReady = allSocketIds.every((socketId) =>
        readySocketIds.includes(socketId),
      );

      // Si todos están listos, emitir evento de inicio
      if (allReady && allSocketIds.length > 0) {
        this.logger.log(
          `Todos los jugadores están listos en ${room}. Emitiendo 'all:ready'`,
        );
        this.gameEventEmitter.emitAllReady(gameId);
      }

      // Confirmar al cliente que se registró su estado "listo"
      this.gameEventEmitter.emitToClient(
        client.id,
        GameEvents.PLAYER_READY_ACK,
        {
          success: true,
        },
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar estado listo: gameId=${gameId}, userId=${client.data.userId}, error=${error}`,
      );
      this.gameEventEmitter.emitToClient(
        client.id,
        GameEvents.PLAYER_READY_ACK,
        {
          success: false,
        },
      );
    }
  }

  /**
   * Procesa cuando un jugador selecciona un equipo en partidas por equipos.
   *
   * Validaciones:
   * - Existencia de la partida
   * - Que la partida sea en modo equipos
   * - Que el número de equipo sea válido según la configuración
   *
   * Tras la selección exitosa, registra al jugador en el equipo y notifica
   * a todos los participantes de la partida.
   *
   * @param client Socket conectado con información del usuario autenticado
   * @param data Información con el ID de la partida y el número de equipo seleccionado
   */
  async onPlayerChooseTeam(
    client: SocketWithUser,
    data: EventPayload<GameEvents.PLAYER_CHOOSE_TEAM>,
  ): Promise<void> {
    const gameId = data.gameId;
    const team = data.team;
    const room = `game:${gameId}`;

    try {
      this.logger.log(
        `Selección de equipo: userId=${client.data.userId}, nickname=${client.data.nickname}, equipo=${team}, gameId=${gameId}`,
      );

      // Obtener información de la partida
      const game = await this.gameRepository.findById(gameId);

      // Validar que la partida exista
      if (!game) {
        this.logger.warn(
          `Intento de seleccionar equipo en partida inexistente: gameId=${gameId}`,
        );
        this.gameEventEmitter.emitError(client.id, 'Partida no encontrada');
        return;
      }

      // Validar que la partida tenga modo equipos
      if (game.mode !== 'teams' || !game.teamCount) {
        this.logger.warn(
          `Selección de equipo inválida: partida gameId=${gameId} no permite equipos`,
        );
        this.gameEventEmitter.emitError(
          client.id,
          'La partida no permite selección de equipos',
        );
        return;
      }

      // Validar que el número de equipo sea válido
      if (team < 1 || team > game.teamCount) {
        this.logger.warn(
          `Número de equipo fuera de rango: solicitado team=${team} en gameId=${gameId}`,
        );
        this.gameEventEmitter.emitError(client.id, 'Número de equipo inválido');
        return;
      }

      // Obtener distribución actual de equipos
      const currentTeams = await this.teamStateRedis.getAllTeams(gameId);
      const teamDistribution = new Map<number, number>();

      // Contar jugadores en cada equipo
      for (const [, teamNumber] of Object.entries(currentTeams)) {
        teamDistribution.set(
          teamNumber,
          (teamDistribution.get(teamNumber) || 0) + 1,
        );
      }

      this.logger.debug(
        `Distribución actual de equipos: gameId=${gameId}, ${Array.from(
          teamDistribution.entries(),
        )
          .map(([team, count]) => `Equipo ${team}: ${count} jugadores`)
          .join(', ')}`,
      );

      // Registrar al jugador en el equipo seleccionado
      await this.teamStateRedis.setPlayerTeam(gameId, client.id, team);

      // Notificar a todos los jugadores sobre la asignación de equipo
      this.gameEventEmitter.emit(gameId, GameEvents.PLAYER_TEAM_ASSIGNED, {
        socketId: client.id,
        team,
      });

      this.logger.log(
        `Jugador socketId=${client.id} asignado exitosamente al team=${team} en room=${room}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar selección de equipo: gameId=${gameId}, userId=${client.data.userId}, error=${error}`,
      );
      this.gameEventEmitter.emitError(
        client.id,
        'Error interno al procesar tu selección de equipo',
      );
    }
  }
}
