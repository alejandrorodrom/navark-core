import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

import { SocketWithUser } from './contracts/socket.types';
import { PlayerFireDto } from './contracts/player-fire.dto';

import { ConnectionHandler } from './handlers/connection.handler';
import { JoinHandler } from './handlers/join.handler';
import { FireHandler } from './handlers/fire.handler';
import { LeaveHandler } from './handlers/leave.handler';
import { CreatorHandler } from './handlers/creator.handler';
import { StartGameHandler } from './handlers/start-game.handler';
import { PlayerJoinDto } from './contracts/player-join.dto';

/**
 * GameGateway maneja la comunicación WebSocket de eventos en tiempo real
 * para las partidas multijugador de Navark.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly connectionHandler: ConnectionHandler,
    private readonly joinHandler: JoinHandler,
    private readonly fireHandler: FireHandler,
    private readonly leaveHandler: LeaveHandler,
    private readonly creatorHandler: CreatorHandler,
    private readonly startGameHandler: StartGameHandler,
  ) {}

  /**
   * Evento de conexión de un nuevo cliente WebSocket.
   * @param client Cliente conectado.
   */
  handleConnection(client: SocketWithUser) {
    return this.connectionHandler.handleConnection(client);
  }

  /**
   * Evento de desconexión de un cliente WebSocket.
   * @param client Cliente desconectado.
   */
  async handleDisconnect(client: SocketWithUser) {
    return this.connectionHandler.handleDisconnect(client);
  }

  /**
   * Un jugador se une a una partida.
   */
  @SubscribeMessage('player:join')
  async onPlayerJoin(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: PlayerJoinDto,
  ) {
    return this.joinHandler.onPlayerJoin(client, data);
  }

  /**
   * Un jugador marca que está listo para iniciar la partida.
   */
  @SubscribeMessage('player:ready')
  async onPlayerReady(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { gameId: number },
  ) {
    return this.joinHandler.onPlayerReady(client, data);
  }

  /**
   * Un jugador selecciona su equipo antes de iniciar la partida.
   */
  @SubscribeMessage('player:chooseTeam')
  async onPlayerChooseTeam(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { gameId: number; team: number },
  ) {
    return this.joinHandler.onPlayerChooseTeam(client, data);
  }

  /**
   * Un jugador abandona voluntariamente la partida.
   */
  @SubscribeMessage('player:leave')
  async onPlayerLeave(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { gameId: number },
  ) {
    return this.leaveHandler.onPlayerLeave(client, data);
  }

  /**
   * El creador de la partida transfiere el rol de creador a otro jugador.
   */
  @SubscribeMessage('creator:transfer')
  async onCreatorTransfer(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { gameId: number; targetUserId: number },
  ) {
    return this.creatorHandler.onCreatorTransfer(client, data);
  }

  /**
   * El creador inicia la partida después de cumplir las condiciones necesarias.
   */
  @SubscribeMessage('game:start')
  async onGameStart(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { gameId: number },
  ) {
    return this.startGameHandler.onGameStart(client, data);
  }

  /**
   * Un jugador ejecuta un disparo sobre otro jugador o equipo.
   */
  @SubscribeMessage('player:fire')
  async onPlayerFire(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: PlayerFireDto,
  ) {
    return this.fireHandler.onPlayerFire(client, data);
  }
}
