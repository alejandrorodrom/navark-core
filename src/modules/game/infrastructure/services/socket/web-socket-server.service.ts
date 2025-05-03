import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class WebSocketServerService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    if (!this.server) {
      throw new Error('WebSocket Server is not initialized yet.');
    }
    return this.server;
  }

  emit(event: string, data: any) {
    this.getServer().emit(event, data);
  }
}
