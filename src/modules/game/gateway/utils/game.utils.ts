import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { Adapter } from 'socket.io-adapter';

@Injectable()
export class GameUtils {
  private readonly logger = new Logger(GameUtils.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  getSocketsInRoom(room: string) {
    const server = this.webSocketServerService.getServer();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const adapter = server.adapter as unknown as Adapter;
    return adapter.rooms.get(room) ?? new Set<string>();
  }

  async findGameIdBySocket(socketId: string): Promise<number | null> {
    const gamePlayer = await this.prismaService.gamePlayer.findFirst({
      where: { board: { path: ['socketId'], equals: socketId } },
      select: { gameId: true },
    });
    return gamePlayer?.gameId ?? null;
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
