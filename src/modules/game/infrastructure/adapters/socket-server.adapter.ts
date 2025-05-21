import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  EventKey,
  EventPayload,
} from '../websocket/events/types/events-payload.type';
import { GameEvents } from '../websocket/events/constants/game-events.enum';
import { SocketWithUser } from '../../domain/types/socket.types';

/**
 * Adaptador centralizado para interactuar con el servidor WebSocket (Socket.IO).
 *
 * Este adaptador ofrece una interfaz tipada para:
 * - Emitir eventos a partidas o jugadores
 * - Expulsar sockets de la sala o del servidor
 * - Obtener sockets conectados y su información de usuario
 */
@Injectable()
export class SocketServerAdapter {
  private readonly logger = new Logger(SocketServerAdapter.name);
  private server: Server;

  /**
   * Establece la instancia del servidor WebSocket.
   * Debe llamarse una vez al inicializar el gateway.
   *
   * @param server Instancia activa de Socket.IO Server
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Obtiene la instancia del servidor WebSocket.
   *
   * @returns Instancia activa de Socket.IO Server
   * @throws Error si aún no ha sido inicializado
   */
  getServer(): Server {
    if (!this.server) {
      throw new Error('WebSocket Server not initialized');
    }
    return this.server;
  }

  /**
   * Emite un evento a todos los sockets en una partida específica.
   *
   * @param gameId ID numérico o string de la partida (sala)
   * @param event Clave del evento a emitir (tipado)
   * @param payload Carga útil correspondiente al evento
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
   * Emite un evento a un socket específico.
   *
   * @param socketId ID del socket de destino
   * @param event Evento a emitir
   * @param payload Datos del evento
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
   * Emite un evento a todas las conexiones activas de un usuario.
   *
   * @param userId ID del usuario
   * @param event Evento a emitir
   * @param payload Datos del evento
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
   * Expulsa a un jugador usando su socketId. Emite un evento previo antes de desconectar.
   *
   * @param socketId ID del socket a desconectar
   * @param reason Motivo de la expulsión (enviado como payload)
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
   * Expulsa a todas las conexiones de un jugador usando su userId.
   *
   * @param userId ID del jugador
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
   * Hace que un socket se una a una sala de juego específica.
   *
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
   * Hace que un socket abandone una sala de juego específica.
   *
   * @param socketId ID del socket
   * @param gameId ID de la sala de juego
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
   * Obtiene los IDs de los sockets conectados a una partida específica.
   *
   * @param gameId ID de la partida
   * @returns Lista de socketIds
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
   * Obtiene los datos del usuario asociados a un socket.
   *
   * @param socketId ID del socket
   * @returns Objeto con userId, nickname e isGuest; o `null` si no se encuentra
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
   * Obtiene todos los socketIds pertenecientes a un usuario específico.
   *
   * @param userId ID del usuario
   * @returns Lista de socketIds
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
   * Obtiene todos los usuarios presentes en una partida junto con sus socketIds.
   *
   * @param gameId ID de la partida
   * @returns Mapa de userId → lista de socketIds
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
        userMap.get(userId)!.push(socketId);
      }
    }

    this.logger.debug(
      `Encontrados ${userMap.size} usuarios en gameId=${gameId}`,
    );
    return userMap;
  }
}
