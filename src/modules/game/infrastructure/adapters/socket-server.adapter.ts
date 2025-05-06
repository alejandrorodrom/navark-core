import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  EventKey,
  EventPayload,
} from '../websocket/events/types/events-payload.type';
import { GameEvents } from '../websocket/events/constants/game-events.enum';
import { SocketWithUser } from '../../domain/types/socket.types';

/**
 * Adaptador para el servidor Socket.IO con métodos tipados
 * para emitir eventos a distintos destinos.
 */
@Injectable()
export class SocketServerAdapter {
  private readonly logger = new Logger(SocketServerAdapter.name);
  private server: Server;

  /**
   * Establece la instancia del servidor Socket.IO
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Obtiene la instancia del servidor Socket.IO
   * @throws Error si el servidor no ha sido inicializado
   */
  getServer(): Server {
    if (!this.server) {
      throw new Error('WebSocket Server not initialized');
    }
    return this.server;
  }

  /**
   * Emite un evento a todos los clientes en una sala de juego específica.
   * @param gameId ID de la partida (sala)
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emitToGame<T extends EventKey>(
    gameId: string | number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    this.getServer().to(`game:${gameId}`).emit(event, payload);
    this.logger.debug(`Evento ${event} emitido a sala game:${gameId}`);
  }

  /**
   * Emite un evento a un cliente específico por su ID de socket.
   * @param socketId ID del socket del cliente
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emitToClient<T extends EventKey>(
    socketId: string,
    event: T,
    payload: EventPayload<T>,
  ): void {
    const socket = this.getServer().sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, payload);
      this.logger.debug(`Evento ${event} emitido a socketId=${socketId}`);
    } else {
      this.logger.warn(`Socket no encontrado: socketId=${socketId}`);
    }
  }

  /**
   * Emite un evento a todos los sockets asociados con un usuario específico.
   * Útil cuando un usuario tiene múltiples conexiones activas.
   * @param userId ID del usuario
   * @param event Tipo de evento a emitir
   * @param payload Datos del evento con tipado seguro según el tipo de evento
   */
  emitToUser<T extends EventKey>(
    userId: number,
    event: T,
    payload: EventPayload<T>,
  ): void {
    const sockets = this.getServer().sockets.sockets;
    let emitCount = 0;

    for (const socket of sockets.values()) {
      const socketUser = socket.data as { userId?: number };
      if (socketUser?.userId === userId) {
        socket.emit(event, payload);
        emitCount++;
      }
    }

    if (emitCount > 0) {
      this.logger.debug(
        `Evento ${event} emitido a ${emitCount} conexiones de userId=${userId}`,
      );
    } else {
      this.logger.warn(
        `No se encontraron conexiones activas para userId=${userId}`,
      );
    }
  }

  /**
   * Expulsa a un jugador del servidor, enviando primero un evento de expulsión
   * y luego desconectando su socket.
   * @param socketId ID del socket del jugador
   * @param reason Motivo de la expulsión
   */
  kickPlayerBySocketId(socketId: string, reason: string): void {
    const socket = this.getServer().sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(GameEvents.PLAYER_KICKED, { reason });
      socket.disconnect(true);
      this.logger.log(
        `Jugador expulsado: socketId=${socketId}, razón=${reason}`,
      );
    } else {
      this.logger.warn(
        `Intento de expulsar socket no encontrado: socketId=${socketId}`,
      );
    }
  }

  /**
   * Expulsa a todos los sockets de un usuario del servidor, enviando primero
   * un evento de expulsión y luego desconectando todos sus sockets.
   * @param userId ID del usuario a expulsar
   * @param reason Motivo de la expulsión
   */
  kickPlayerByUserId(userId: number, reason: string): void {
    const sockets = this.getServer().sockets.sockets;
    let disconnectCount = 0;

    for (const socket of sockets.values()) {
      const socketUser = socket.data as { userId?: number };
      if (socketUser?.userId === userId) {
        socket.emit(GameEvents.PLAYER_KICKED, { reason });
        socket.disconnect(true);
        disconnectCount++;
      }
    }

    if (disconnectCount > 0) {
      this.logger.log(
        `Usuario expulsado: userId=${userId}, razón=${reason}, conexiones=${disconnectCount}`,
      );
    } else {
      this.logger.warn(
        `Intento de expulsar usuario sin conexiones activas: userId=${userId}`,
      );
    }
  }

  /**
   * Hace que un socket se una a una sala de juego.
   * @param socketId ID del socket
   * @param gameId ID de la partida (sala)
   */
  async joinGameRoom(socketId: string, gameId: number): Promise<void> {
    const socket = this.getServer().sockets.sockets.get(socketId);
    if (socket) {
      await socket.join(`game:${gameId}`);
      this.logger.debug(
        `Socket unido a sala: socketId=${socketId}, gameId=${gameId}`,
      );
    } else {
      this.logger.warn(
        `Intento de unir socket no encontrado: socketId=${socketId}`,
      );
    }
  }

  /**
   * Hace que un socket abandone una sala de juego.
   * @param socketId ID del socket
   * @param gameId ID de la partida (sala)
   */
  async leaveGameRoom(socketId: string, gameId: number): Promise<void> {
    const socket = this.getServer().sockets.sockets.get(socketId);
    if (socket) {
      await socket.leave(`game:${gameId}`);
      this.logger.debug(
        `Socket abandonó sala: socketId=${socketId}, gameId=${gameId}`,
      );
    } else {
      this.logger.warn(
        `Intento de sacar socket no encontrado: socketId=${socketId}`,
      );
    }
  }

  /**
   * Obtiene la lista de sockets conectados en una sala específica.
   * @param gameId ID de la partida (sala)
   * @returns Array de IDs de sockets
   */
  getSocketsInGame(gameId: number): string[] {
    const roomName = `game:${gameId}`;
    const room = this.getServer().sockets.adapter.rooms.get(roomName);
    const sockets = room ? Array.from(room) : [];

    this.logger.debug(
      `Obtenidos ${sockets.length} sockets en sala: gameId=${gameId}`,
    );
    return sockets;
  }

  /**
   * Obtiene los datos de usuario asociados a un socket.
   * @param socketId ID del socket
   * @returns Datos del usuario o null si no se encontraron
   */
  getSocketUserData(
    socketId: string,
  ): { userId: number; nickname: string; isGuest: boolean } | null {
    const socket = this.getServer().sockets.sockets.get(
      socketId,
    ) as SocketWithUser;
    if (socket?.data?.userId) {
      return {
        userId: socket.data.userId,
        nickname: socket.data.nickname || 'Jugador',
        isGuest: socket.data.isGuest || false,
      };
    }
    this.logger.warn(
      `Datos de usuario no encontrados para socketId=${socketId}`,
    );
    return null;
  }

  /**
   * Obtiene todos los sockets asociados a un usuario específico.
   * @param userId ID del usuario
   * @returns Array de IDs de sockets pertenecientes al usuario
   */
  getUserSockets(userId: number): string[] {
    const sockets = this.getServer().sockets.sockets;
    const userSocketIds: string[] = [];

    for (const [socketId, socket] of sockets.entries()) {
      const socketUser = socket.data as { userId?: number };
      if (socketUser?.userId === userId) {
        userSocketIds.push(socketId);
      }
    }

    this.logger.debug(
      `Encontradas ${userSocketIds.length} conexiones para userId=${userId}`,
    );
    return userSocketIds;
  }

  /**
   * Obtiene todos los usuarios conectados a una sala de juego.
   * @param gameId ID de la partida (sala)
   * @returns Map de userId a un array de socketIds
   */
  getUsersInGame(gameId: number): Map<number, string[]> {
    const socketIds = this.getSocketsInGame(gameId);
    const userMap = new Map<number, string[]>();

    for (const socketId of socketIds) {
      const userData = this.getSocketUserData(socketId);
      if (userData) {
        const { userId } = userData;
        if (!userMap.has(userId)) {
          userMap.set(userId, []);
        }
        userMap.get(userId)?.push(socketId);
      }
    }

    this.logger.debug(
      `Encontrados ${userMap.size} usuarios en gameId=${gameId}`,
    );
    return userMap;
  }
}
