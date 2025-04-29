import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { Adapter } from 'socket.io-adapter';

@Injectable()
export class GameUtils {
  private readonly logger = new Logger(GameUtils.name);

  constructor(
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  getSocketsInRoom(room: string) {
    const server = this.webSocketServerService.getServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const adapter = server.adapter as unknown as Adapter;
    return adapter.rooms.get(room) ?? new Set<string>();
  }

  async kickPlayersFromRoom(
    gameId: number,
    reason: 'ended' | 'abandoned' = 'ended',
  ): Promise<void> {
    const server = this.webSocketServerService.getServer();
    const room = `game:${gameId}`;
    const socketsInRoom = this.getSocketsInRoom(room);

    for (const socketId of socketsInRoom) {
      const socket = server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('game:finished', { reason });
        await socket.leave(room);
      }
    }

    this.logger.log(
      `Todos los jugadores y espectadores fueron expulsados de la sala ${room}`,
    );
  }
}
