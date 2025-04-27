import { Injectable, Logger } from '@nestjs/common';
import { GameUtils } from '../utils/game.utils';
import { RedisUtils } from '../utils/redis.utils';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { Server } from 'socket.io';

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
    private readonly server: Server,
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

    const gameId = await this.gameUtils.findGameIdBySocket(client.id);
    if (!gameId) {
      this.logger.warn(
        `No se encontró partida asociada al socketId=${client.id}`,
      );
      return;
    }

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
      `Procesando desconexión en sala ${room} para userId=${client.data.userId}`,
    );

    this.server.to(room).emit('player:left', {
      userId: client.data.userId,
      nickname: client.data.nickname,
    });

    const allSocketIds = this.gameUtils.getSocketsInRoom(room);
    const remainingSocketIds = [...allSocketIds].filter(
      (id) => id !== client.id,
    );

    // Si la sala queda vacía, eliminar partida
    if (remainingSocketIds.length === 0) {
      this.logger.warn(`Partida vacía detectada. Eliminando gameId=${gameId}.`);

      this.server.to(room).emit('game:abandoned');
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

    // Si el creador abandona, transferir automáticamente el rol
    if (game.createdById === client.data.userId) {
      this.logger.warn(
        `Creador actual desconectado. Buscando nuevo creador para gameId=${gameId}.`,
      );

      const fallbackSocketId = remainingSocketIds[0];
      const fallbackSocket = this.server.sockets.sockets.get(
        fallbackSocketId,
      ) as SocketWithUser;

      if (fallbackSocket?.data?.userId) {
        await this.prismaService.game.update({
          where: { id: gameId },
          data: { createdById: fallbackSocket.data.userId },
        });

        this.server.to(room).emit('creator:changed', {
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
