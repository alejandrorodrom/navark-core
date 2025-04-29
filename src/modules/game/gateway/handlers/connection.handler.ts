import { Injectable, Logger } from '@nestjs/common';
import { GameUtils } from '../utils/game.utils';
import { RedisUtils } from '../utils/redis.utils';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { WebSocketServerService } from '../services/web-socket-server.service';

/**
 * ConnectionHandler gestiona eventos de conexión y desconexión
 * de clientes en partidas multijugador en tiempo real.
 */
@Injectable()
export class ConnectionHandler {
  private readonly logger = new Logger(ConnectionHandler.name);

  constructor(
    private readonly gameUtils: GameUtils,
    private readonly redisUtils: RedisUtils,
    private readonly prismaService: PrismaService,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  /**
   * Registra la conexión de un nuevo cliente WebSocket.
   * @param client Cliente que se ha conectado.
   */
  handleConnection(client: SocketWithUser): void {
    this.logger.log(`Cliente conectado: socketId=${client.id}`);
  }

  /**
   * Maneja la desconexión de un cliente del servidor WebSocket.
   * Administra su salida de la partida, reasigna el creador si es necesario,
   * y elimina la partida si queda vacía.
   *
   * @param client Cliente que se ha desconectado.
   */
  async handleDisconnect(client: SocketWithUser): Promise<void> {
    this.logger.log(`Cliente desconectado: socketId=${client.id}`);

    // 🔥 NUEVO: Obtener gameId y userId directamente desde Redis
    const mapping = await this.redisUtils.getSocketMapping(client.id);

    if (!mapping) {
      this.logger.warn(`No se encontró mapeo para socketId=${client.id}`);
      return;
    }

    const { gameId, userId } = mapping;

    await this.redisUtils.deleteSocketMapping(client.id);

    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
    });
    if (!game) {
      this.logger.warn(
        `Partida inexistente en base de datos: gameId=${gameId}`,
      );
      return;
    }

    const room = `game:${gameId}`;
    this.logger.log(
      `Procesando desconexión en sala ${room} para userId=${userId}`,
    );

    const server = this.webSocketServerService.getServer();

    server.to(room).emit('player:left', {
      userId,
      nickname: client.data.nickname,
    });

    const allSocketIds = this.gameUtils.getSocketsInRoom(room);
    const remainingSocketIds = [...allSocketIds].filter(
      (id) => id !== client.id,
    );

    if (remainingSocketIds.length === 0) {
      this.logger.warn(`Partida vacía detectada. Eliminando gameId=${gameId}.`);

      server.to(room).emit('game:abandoned');
      await this.gameUtils.kickPlayersFromRoom(gameId, 'abandoned');

      await Promise.all([
        this.prismaService.shot.deleteMany({ where: { gameId } }),
        this.prismaService.spectator.deleteMany({ where: { gameId } }),
        this.prismaService.gamePlayer.deleteMany({ where: { gameId } }),
        this.prismaService.game.delete({ where: { id: gameId } }),
        this.redisUtils.clearGameRedisState(gameId),
      ]);

      this.logger.log(`Partida gameId=${gameId} eliminada correctamente.`);
      return;
    }

    if (game.createdById === userId) {
      this.logger.warn(
        `Creador actual desconectado. Buscando nuevo creador para gameId=${gameId}.`,
      );

      const fallbackSocketId = remainingSocketIds[0];
      const fallbackSocket = server.sockets.sockets.get(
        fallbackSocketId,
      ) as SocketWithUser;

      if (fallbackSocket?.data?.userId) {
        await this.prismaService.game.update({
          where: { id: gameId },
          data: { createdById: fallbackSocket.data.userId },
        });

        server.to(room).emit('creator:changed', {
          newCreatorUserId: fallbackSocket.data.userId,
          newCreatorNickname:
            fallbackSocket.data.nickname ?? 'Jugador desconocido',
        });

        this.logger.log(
          `Nuevo creador asignado automáticamente: userId=${fallbackSocket.data.userId} para gameId=${gameId}`,
        );
      } else {
        this.logger.error(
          `Error al reasignar creador: No se encontró socket válido para gameId=${gameId}`,
        );
      }
    }
  }
}
