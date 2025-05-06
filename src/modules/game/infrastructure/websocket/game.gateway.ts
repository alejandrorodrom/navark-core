import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

import { SocketWithUser } from '../../domain/types/socket.types';
import { GameEvents } from './events/constants/game-events.enum';
import { EventPayload } from './events/types/events-payload.type';

import { ConnectionHandler } from './handlers/connection.handler';
import { JoinHandler } from './handlers/join.handler';
import { FireHandler } from './handlers/fire.handler';
import { LeaveHandler } from './handlers/leave.handler';
import { CreatorHandler } from './handlers/creator.handler';
import { StartGameHandler } from './handlers/start-game.handler';
import { SocketServerAdapter } from '../adapters/socket-server.adapter';
import { ReconnectHandler } from './handlers/reconnect.handler';

/**
 * GameGateway maneja la comunicación WebSocket de eventos en tiempo real
 * para las partidas multijugador de Navark.
 *
 * Implementa manejo de conexiones, desconexiones y todos los eventos de juego,
 * utilizando un sistema de eventos tipados para garantizar la integridad de los datos.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  /** Instancia del servidor WebSocket */
  @WebSocketServer()
  server: Server;

  /** Logger específico para el gateway de juego */
  private readonly logger = new Logger(GameGateway.name);

  /**
   * Constructor con inyección de todas las dependencias necesarias
   */
  constructor(
    private readonly connectionHandler: ConnectionHandler,
    private readonly reconnectHandler: ReconnectHandler,
    private readonly joinHandler: JoinHandler,
    private readonly fireHandler: FireHandler,
    private readonly leaveHandler: LeaveHandler,
    private readonly creatorHandler: CreatorHandler,
    private readonly startGameHandler: StartGameHandler,
    private readonly webSocketServerService: SocketServerAdapter,
  ) {}

  /**
   * Inicializa el servidor WebSocket y lo comparte con el adaptador
   * para que otros servicios puedan utilizarlo.
   */
  afterInit() {
    this.webSocketServerService.setServer(this.server);
    this.logger.log('WebSocket Server inicializado');
  }

  /**
   * Gestiona el evento de conexión de un nuevo cliente WebSocket.
   * Intenta reconectar al usuario si viene con identificación.
   * @param client Cliente conectado con información de usuario si está autenticado
   */
  async handleConnection(client: SocketWithUser) {
    this.logger.debug(`Nueva conexión: ${client.id}`);

    if (client.data?.userId) {
      this.logger.debug(
        `Intento de reconexión para el usuario ${client.data.userId}`,
      );
      await this.reconnectHandler.handleReconnect(client);
    }

    return this.connectionHandler.handleConnection(client);
  }

  /**
   * Gestiona el evento de desconexión de un cliente WebSocket.
   * @param client Cliente desconectado
   */
  async handleDisconnect(client: SocketWithUser) {
    this.logger.debug(`Desconexión: ${client.id}`);
    return this.connectionHandler.handleDisconnect(client);
  }

  /**
   * Procesa el evento cuando un jugador intenta unirse a una partida.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos para unirse a una partida con tipado seguro
   */
  @SubscribeMessage(GameEvents.PLAYER_JOIN)
  async onPlayerJoin(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.PLAYER_JOIN>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.PLAYER_JOIN} - Usuario: ${client.data?.userId}, Game: ${data.gameId}`,
    );
    return this.joinHandler.onPlayerJoin(client, data);
  }

  /**
   * Procesa el evento cuando un jugador indica que está listo para iniciar la partida.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida y tipado seguro
   */
  @SubscribeMessage(GameEvents.PLAYER_READY)
  async onPlayerReady(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.PLAYER_READY>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.PLAYER_READY} - Usuario: ${client.data?.userId}, Game: ${data.gameId}`,
    );
    return this.joinHandler.onPlayerReady(client, data);
  }

  /**
   * Procesa el evento cuando un jugador selecciona su equipo antes de iniciar la partida.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida, equipo seleccionado y tipado seguro
   */
  @SubscribeMessage(GameEvents.PLAYER_CHOOSE_TEAM)
  async onPlayerChooseTeam(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.PLAYER_CHOOSE_TEAM>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.PLAYER_CHOOSE_TEAM} - Usuario: ${client.data?.userId}, Game: ${data.gameId}, Team: ${data.team}`,
    );
    return this.joinHandler.onPlayerChooseTeam(client, data);
  }

  /**
   * Procesa el evento cuando un jugador abandona voluntariamente la partida.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida y tipado seguro
   */
  @SubscribeMessage(GameEvents.PLAYER_LEAVE)
  async onPlayerLeave(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.PLAYER_LEAVE>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.PLAYER_LEAVE} - Usuario: ${client.data?.userId}, Game: ${data.gameId}`,
    );
    return this.leaveHandler.onPlayerLeave(client, data);
  }

  /**
   * Procesa el evento cuando el creador de la partida transfiere el rol a otro jugador.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida, ID de usuario objetivo y tipado seguro
   */
  @SubscribeMessage(GameEvents.CREATOR_TRANSFER)
  async onCreatorTransfer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.CREATOR_TRANSFER>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.CREATOR_TRANSFER} - Usuario: ${client.data?.userId}, Game: ${data.gameId}, Target: ${data.targetUserId}`,
    );
    return this.creatorHandler.onCreatorTransfer(client, data);
  }

  /**
   * Procesa el evento cuando el creador inicia la partida.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida y tipado seguro
   */
  @SubscribeMessage(GameEvents.GAME_START)
  async onGameStart(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.GAME_START>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.GAME_START} - Usuario: ${client.data?.userId}, Game: ${data.gameId}`,
    );
    return this.startGameHandler.onGameStart(client, data);
  }

  /**
   * Procesa el evento cuando un jugador ejecuta un disparo.
   * @param client Socket del cliente que realiza la petición
   * @param data Datos con el ID de la partida, coordenadas y tipo de disparo con tipado seguro
   */
  @SubscribeMessage(GameEvents.PLAYER_FIRE)
  async onPlayerFire(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: EventPayload<GameEvents.PLAYER_FIRE>,
  ) {
    this.logger.debug(
      `Evento ${GameEvents.PLAYER_FIRE} - Usuario: ${client.data?.userId}, Game: ${data.gameId}, Pos: (${data.x},${data.y}), Tipo: ${data.shotType}`,
    );
    return this.fireHandler.onPlayerFire(client, data);
  }
}
