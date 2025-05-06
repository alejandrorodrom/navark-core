import { Injectable, Logger } from '@nestjs/common';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';
import { GameEvents } from '../constants/game-events.enum';
import { EventKey, EventPayload } from '../types/events-payload.type';

/**
 * Servicio centralizado para emisión de eventos WebSocket con tipado seguro.
 * Proporciona métodos específicos para los eventos más comunes y un método genérico
 * para cualquier otro evento.
 */
@Injectable()
export class GameEventEmitter {
  private readonly logger = new Logger(GameEventEmitter.name);

  constructor(private readonly socketServer: SocketServerAdapter) {}

  /**
   * Emite un evento a todos los clientes en una sala de juego específica.
   * @param gameId ID de la partida (sala)
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emit<T extends EventKey>(
    gameId: string | number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToGame(gameId, event, payload);
  }

  /**
   * Emite un evento a un cliente específico.
   * @param socketId ID del socket del cliente
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emitToClient<T extends EventKey>(
    socketId: string,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToClient(socketId, event, payload);
  }

  /**
   * Emite un evento a un usuario específico (puede tener múltiples conexiones).
   * @param userId ID del usuario
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emitToUser<T extends EventKey>(
    userId: number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToUser(userId, event, payload);
  }

  // ===== MÉTODOS DE CONVENIENCIA PARA EVENTOS COMUNES =====

  /**
   * Emite un evento que notifica que un jugador se ha unido al juego.
   */
  emitPlayerJoined(gameId: number, socketId: string | number): void {
    this.emit(gameId, GameEvents.PLAYER_JOINED, { socketId });
  }

  /**
   * Emite un evento que confirma la unión exitosa como jugador.
   */
  emitPlayerJoinedAck(
    socketId: string,
    data: EventPayload<GameEvents.PLAYER_JOINED_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.PLAYER_JOINED_ACK, data);
  }

  /**
   * Emite un evento que confirma la unión exitosa como espectador.
   */
  emitSpectatorJoinedAck(
    socketId: string,
    data: EventPayload<GameEvents.SPECTATOR_JOINED_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.SPECTATOR_JOINED_ACK, data);
  }

  /**
   * Emite un evento informando que se denegó la unión.
   */
  emitJoinDenied(socketId: string, reason: string): void {
    this.emitToClient(socketId, GameEvents.JOIN_DENIED, { reason });
  }

  /**
   * Emite un evento de cambio de turno a todos los jugadores.
   */
  emitTurnChanged(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.TURN_CHANGED, { userId });
  }

  /**
   * Emite un evento de timeout de turno a todos los jugadores.
   */
  emitTurnTimeout(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.TURN_TIMEOUT, { userId });
  }

  /**
   * Emite un evento de finalización de juego con resultados.
   */
  emitGameEnded(
    gameId: number,
    data: EventPayload<GameEvents.GAME_ENDED>,
  ): void {
    this.emit(gameId, GameEvents.GAME_ENDED, data);
  }

  /**
   * Emite un evento que notifica que un jugador ha sido eliminado.
   */
  emitPlayerEliminated(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.PLAYER_ELIMINATED, { userId });
  }

  /**
   * Emite un evento que notifica que un jugador ha sido expulsado.
   */
  emitPlayerKicked(socketId: string, reason: string): void {
    this.socketServer.kickPlayerBySocketId(socketId, reason);
  }

  /**
   * Emite un evento que notifica que un jugador ha sido expulsado, usando el userId
   * en lugar del socketId. Útil para expulsar a un jugador que tiene múltiples
   * conexiones o cuando no conocemos su socketId actual.
   */
  emitPlayerKickedByUserId(userId: number, reason: string): void {
    this.socketServer.kickPlayerByUserId(userId, reason);
  }

  /**
   * Emite un evento que notifica sobre el resultado de un disparo.
   */
  emitPlayerFired(
    gameId: number,
    data: EventPayload<GameEvents.PLAYER_FIRED>,
  ): void {
    this.emit(gameId, GameEvents.PLAYER_FIRED, data);
  }

  /**
   * Emite un evento de confirmación de disparo al jugador que disparó.
   */
  emitPlayerFireAck(
    socketId: string,
    data: EventPayload<GameEvents.PLAYER_FIRE_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.PLAYER_FIRE_ACK, data);
  }

  /**
   * Emite un evento de actualización del tablero a un jugador específico.
   */
  emitBoardUpdate(
    userId: number,
    data: EventPayload<GameEvents.BOARD_UPDATE>,
  ): void {
    this.emitToUser(userId, GameEvents.BOARD_UPDATE, data);
  }

  /**
   * Emite un evento de error a un cliente específico.
   */
  emitError(socketId: string, message: string, code?: string): void {
    this.emitToClient(socketId, GameEvents.ERROR, { message, code });
  }

  /**
   * Emite un evento que notifica que todos los jugadores están listos.
   */
  emitAllReady(gameId: number): void {
    this.emit(gameId, GameEvents.ALL_READY, null);
  }

  /**
   * Emite un evento que notifica que el juego ha sido abandonado.
   */
  emitGameAbandoned(gameId: number): void {
    this.emit(gameId, GameEvents.GAME_ABANDONED, null);
  }

  /**
   * Emite un evento que notifica que el juego ha comenzado.
   */
  emitGameStarted(gameId: number): void {
    this.emit(gameId, GameEvents.GAME_STARTED, { gameId });
  }

  /**
   * Emite un evento de confirmación de inicio de juego.
   */
  emitGameStartAck(socketId: string, success: boolean, error?: string): void {
    this.emitToClient(socketId, GameEvents.GAME_START_ACK, { success, error });
  }

  /**
   * Emite un evento que notifica a todos los jugadores en una sala que
   * un jugador específico está listo.
   */
  emitPlayerReadyNotify(gameId: number, socketId: string): void {
    this.emit(gameId, GameEvents.PLAYER_READY_NOTIFY, { socketId });
  }

  /**
   * Emite un evento de confirmación de que un jugador está listo.
   */
  emitPlayerReadyAck(socketId: string, success: boolean): void {
    this.emitToClient(socketId, GameEvents.PLAYER_READY_ACK, { success });
  }

  /**
   * Emite un evento informando que un jugador ha abandonado la partida.
   */
  emitPlayerLeft(gameId: number, userId: number, nickname: string): void {
    this.emit(gameId, GameEvents.PLAYER_LEFT, { userId, nickname });
  }

  /**
   * Emite un evento de cambio de creador a todos los jugadores de una sala.
   */
  emitCreatorChanged(
    gameId: number,
    newCreatorUserId: number,
    newCreatorNickname: string,
  ): void {
    this.emit(gameId, GameEvents.CREATOR_CHANGED, {
      newCreatorUserId,
      newCreatorNickname,
    });
  }

  /**
   * Emite un evento de confirmación de transferencia de creador.
   */
  emitCreatorTransferAck(
    socketId: string,
    success: boolean,
    error?: string,
  ): void {
    this.emitToClient(socketId, GameEvents.CREATOR_TRANSFER_ACK, {
      success,
      error,
    });
  }

  /**
   * Emite un evento que notifica que un jugador ha sido asignado a un equipo.
   */
  emitPlayerTeamAssigned(gameId: number, socketId: string, team: number): void {
    this.emit(gameId, GameEvents.PLAYER_TEAM_ASSIGNED, { socketId, team });
  }

  /**
   * Emite un evento que notifica sobre el estado del arma nuclear.
   */
  emitNuclearStatus(
    gameId: number,
    progress: number,
    hasNuclear: boolean,
    used: boolean,
  ): void {
    this.emit(gameId, GameEvents.NUCLEAR_STATUS, {
      progress,
      hasNuclear,
      used,
    });
  }

  /**
   * Emite un evento que notifica que un jugador se ha reconectado.
   */
  emitPlayerReconnected(
    gameId: number,
    userId: number,
    nickname: string,
  ): void {
    this.emit(gameId, GameEvents.PLAYER_RECONNECTED, { userId, nickname });
  }

  /**
   * Emite un evento de confirmación de reconexión exitosa.
   */
  emitReconnectAck(socketId: string, success: boolean): void {
    this.emitToClient(socketId, GameEvents.RECONNECT_ACK, { success });
  }

  /**
   * Emite un evento informando que la reconexión falló.
   */
  emitReconnectFailed(socketId: string, reason: string): void {
    this.emitToClient(socketId, GameEvents.RECONNECT_FAILED, { reason });
  }

  /**
   * Emite un evento de latido (heartbeat) para mantener la conexión activa.
   */
  emitHeartbeat(socketId: string): void {
    this.emitToClient(socketId, GameEvents.HEARTBEAT, null);
  }
}
