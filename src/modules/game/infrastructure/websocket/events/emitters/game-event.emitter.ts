import { Injectable } from '@nestjs/common';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';
import { GameEvents } from '../constants/game-events.enum';
import { EventKey, EventPayload } from '../types/events-payload.type';

/**
 * Servicio centralizado para emitir eventos WebSocket tipados durante la partida.
 * Internamente utiliza el adaptador `SocketServerAdapter` para emitir eventos
 * a salas, sockets individuales o todos los sockets de un usuario.
 */
@Injectable()
export class GameEventEmitter {
  constructor(private readonly socketServer: SocketServerAdapter) {}

  /**
   * Método genérico para emitir un evento a todos los jugadores dentro de una sala.
   *
   * @template T Tipo del evento basado en enum `GameEvents`
   * @param gameId ID de la sala (normalmente es el ID de la partida)
   * @param event Nombre del evento a emitir
   * @param payload Cuerpo del evento con el tipo correspondiente
   */
  emit<T extends EventKey>(
    gameId: string | number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToGame(gameId, event, payload);
  }

  /**
   * Método genérico para emitir un evento a un socket específico (cliente).
   *
   * @template T Tipo del evento
   * @param socketId ID del socket al que se desea enviar el evento
   * @param event Evento a emitir
   * @param payload Cuerpo del evento
   */
  emitToClient<T extends EventKey>(
    socketId: string,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToClient(socketId, event, payload);
  }

  /**
   * Método genérico para emitir un evento a todas las conexiones (sockets) de un usuario.
   * Útil cuando el usuario tiene múltiples pestañas abiertas o está conectado desde distintos dispositivos.
   *
   * @template T Tipo del evento
   * @param userId ID del usuario
   * @param event Evento a emitir
   * @param payload Cuerpo del evento
   */
  emitToUser<T extends EventKey>(
    userId: number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.socketServer.emitToUser(userId, event, payload);
  }

  // ==== MÉTODOS SEMÁNTICOS ====

  /** Notifica a la sala que un jugador se ha unido */
  emitPlayerJoined(gameId: number, socketId: string | number): void {
    this.emit(gameId, GameEvents.PLAYER_JOINED, { socketId });
  }

  /** Confirma al cliente que se ha unido correctamente como jugador */
  emitPlayerJoinedAck(
    socketId: string,
    data: EventPayload<GameEvents.PLAYER_JOINED_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.PLAYER_JOINED_ACK, data);
  }

  /** Confirma al cliente que se ha unido correctamente como espectador */
  emitSpectatorJoinedAck(
    socketId: string,
    data: EventPayload<GameEvents.SPECTATOR_JOINED_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.SPECTATOR_JOINED_ACK, data);
  }

  /** Notifica al cliente que su intento de unión fue denegado */
  emitJoinDenied(socketId: string, reason: string): void {
    this.emitToClient(socketId, GameEvents.JOIN_DENIED, { reason });
  }

  /** Notifica a todos los jugadores de un cambio de turno */
  emitTurnChanged(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.TURN_CHANGED, { userId });
  }

  /** Notifica a todos los jugadores que un turno fue perdido por timeout */
  emitTurnTimeout(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.TURN_TIMEOUT, { userId });
  }

  /** Notifica el fin de la partida junto con los resultados */
  emitGameEnded(
    gameId: number,
    data: EventPayload<GameEvents.GAME_ENDED>,
  ): void {
    this.emit(gameId, GameEvents.GAME_ENDED, data);
  }

  /** Notifica que un jugador ha sido eliminado de la partida */
  emitPlayerEliminated(gameId: number, userId: number): void {
    this.emit(gameId, GameEvents.PLAYER_ELIMINATED, { userId });
  }

  /** Expulsa a un socket específico y lo desconecta */
  emitPlayerKicked(socketId: string, reason: string): void {
    this.socketServer.kickPlayerBySocketId(socketId, reason);
  }

  /** Expulsa a todos los sockets de un usuario identificado por ID */
  emitPlayerKickedByUserId(userId: number, reason: string): void {
    this.socketServer.kickPlayerByUserId(userId, reason);
  }

  /** Emite a la sala el resultado de un disparo */
  emitPlayerFired(
    gameId: number,
    data: EventPayload<GameEvents.PLAYER_FIRED>,
  ): void {
    this.emit(gameId, GameEvents.PLAYER_FIRED, data);
  }

  /** Confirma al jugador que su disparo fue procesado */
  emitPlayerFireAck(
    socketId: string,
    data: EventPayload<GameEvents.PLAYER_FIRE_ACK>,
  ): void {
    this.emitToClient(socketId, GameEvents.PLAYER_FIRE_ACK, data);
  }

  /** Actualiza el tablero de un jugador específico */
  emitBoardUpdate(
    userId: number,
    data: EventPayload<GameEvents.BOARD_UPDATE>,
  ): void {
    this.emitToUser(userId, GameEvents.BOARD_UPDATE, data);
  }

  /** Notifica un error al cliente */
  emitError(socketId: string, message: string, code?: string): void {
    this.emitToClient(socketId, GameEvents.ERROR, { message, code });
  }

  /** Notifica que todos los jugadores han marcado "listo" */
  emitAllReady(gameId: number): void {
    this.emit(gameId, GameEvents.ALL_READY, null);
  }

  /** Notifica que la partida fue abandonada */
  emitGameAbandoned(gameId: number): void {
    this.emit(gameId, GameEvents.GAME_ABANDONED, null);
  }

  /** Notifica que la partida ha comenzado */
  emitGameStarted(gameId: number): void {
    this.emit(gameId, GameEvents.GAME_STARTED, { gameId });
  }

  /** Confirma al cliente que el juego comenzó (o falló) */
  emitGameStartAck(socketId: string, success: boolean, error?: string): void {
    this.emitToClient(socketId, GameEvents.GAME_START_ACK, { success, error });
  }

  /** Notifica que un jugador está listo */
  emitPlayerReadyNotify(gameId: number, socketId: string): void {
    this.emit(gameId, GameEvents.PLAYER_READY_NOTIFY, { socketId });
  }

  /** Confirma al jugador que su estado de "listo" fue recibido */
  emitPlayerReadyAck(socketId: string, success: boolean): void {
    this.emitToClient(socketId, GameEvents.PLAYER_READY_ACK, { success });
  }

  /** Notifica a la sala que un jugador abandonó la partida */
  emitPlayerLeft(gameId: number, userId: number, nickname: string): void {
    this.emit(gameId, GameEvents.PLAYER_LEFT, { userId, nickname });
  }

  /** Notifica a la sala que se ha cambiado el creador */
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

  /** Confirma al cliente que la transferencia de creador fue procesada */
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

  /** Notifica a la sala que un jugador fue asignado a un equipo */
  emitPlayerTeamAssigned(gameId: number, socketId: string, team: number): void {
    this.emit(gameId, GameEvents.PLAYER_TEAM_ASSIGNED, { socketId, team });
  }

  /** Emite información sobre el estado del arma nuclear de un jugador */
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

  /** Notifica a la sala que un jugador se ha reconectado */
  emitPlayerReconnected(
    gameId: number,
    userId: number,
    nickname: string,
  ): void {
    this.emit(gameId, GameEvents.PLAYER_RECONNECTED, { userId, nickname });
  }

  /** Confirma al cliente que se reconectó exitosamente */
  emitReconnectAck(socketId: string, success: boolean): void {
    this.emitToClient(socketId, GameEvents.RECONNECT_ACK, { success });
  }

  /** Notifica al cliente que la reconexión ha fallado */
  emitReconnectFailed(socketId: string, reason: string): void {
    this.emitToClient(socketId, GameEvents.RECONNECT_FAILED, { reason });
  }

  /** Evento de latido para mantener conexión activa */
  emitHeartbeat(socketId: string): void {
    this.emitToClient(socketId, GameEvents.HEARTBEAT, null);
  }
}
