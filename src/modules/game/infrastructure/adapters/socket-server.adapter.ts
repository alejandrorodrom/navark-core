import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class SocketServerAdapter {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    if (!this.server) {
      throw new Error('WebSocket Server not initialized');
    }
    return this.server;
  }

  emitToGame(gameId: number, event: string, payload: any): void {
    this.getServer().to(`game:${gameId}`).emit(event, payload);
  }

  emitToSocket(socketId: string, event: string, payload: any): void {
    const socket = this.getServer().sockets.sockets.get(socketId);
    if (socket) {
      socket.emit(event, payload);
    }
  }

  kickPlayer(userId: number, payload: any): void {
    const sockets = this.getServer().sockets.sockets;
    for (const socket of sockets.values()) {
      const socketUser = socket.data as { userId: number };
      if (socketUser?.userId === userId) {
        socket.emit('player:kicked', payload);
        socket.disconnect(true);
      }
    }
  }
}
