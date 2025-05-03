import { Injectable, Logger } from '@nestjs/common';
import { GameRoomManagerService } from '../../services/socket/game-room-manager.service';
import { GameRedisStateService } from '../../redis/game-redis-state.service';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { WebSocketServerService } from '../../services/socket/web-socket-server.service';
import { GameRepository } from '../../../domain/repository/game.repository';

/**
 * LeaveHandler maneja la lógica cuando un jugador abandona voluntariamente una partida,
 * incluyendo la limpieza si la partida queda vacía y la reasignación de creador si es necesario.
 */
@Injectable()
export class LeaveHandler {
  private readonly logger = new Logger(LeaveHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly gameUtils: GameRoomManagerService,
    private readonly redisUtils: GameRedisStateService,
    private readonly webSocketServerService: WebSocketServerService,
  ) {}

  /**
   * Procesa la salida voluntaria de un jugador de una partida en curso.
   * Si el creador abandona, transfiere el liderazgo automáticamente.
   * Si la partida queda vacía, la elimina.
   *
   * @param client Cliente que abandona.
   * @param data Contiene el ID de la partida (`gameId`).
   */
  async onPlayerLeave(
    client: SocketWithUser,
    data: { gameId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;

    this.logger.log(
      `Jugador socketId=${client.id} (userId=${client.data.userId}) solicitó abandonar partida gameId=${data.gameId}`,
    );

    const server = this.webSocketServerService.getServer();

    server.to(room).emit('player:left', {
      userId: client.data.userId,
      nickname: client.data.nickname,
    });

    await client.leave(room);

    const gameId = data.gameId;
    const game = await this.gameRepository.findById(gameId);

    if (!game) {
      this.logger.warn(
        `No se encontró partida en base de datos al intentar abandonar: gameId=${gameId}`,
      );
      return;
    }

    const allSocketIds = this.gameUtils.getSocketsInRoom(room);

    // Si la partida queda vacía
    if (allSocketIds.size === 0) {
      this.logger.log(
        `La partida gameId=${gameId} quedó vacía tras la salida. Eliminando partida...`,
      );

      server.to(room).emit('game:abandoned');
      await this.gameUtils.kickPlayersFromRoom(gameId, 'abandoned');

      await this.gameRepository.removeAbandonedGames(gameId);
      await this.redisUtils.clearGameRedisState(gameId);

      this.logger.log(`Partida gameId=${gameId} eliminada exitosamente.`);
      return;
    }

    // Si el jugador que se fue era el creador
    if (game.createdById === client.data.userId) {
      this.logger.warn(
        `El creador abandonó la partida gameId=${gameId}. Buscando nuevo creador...`,
      );

      const fallbackSocketId = [...allSocketIds][0];
      const fallbackSocket = server.sockets.sockets.get(
        fallbackSocketId,
      ) as SocketWithUser;

      if (fallbackSocket?.data?.userId) {
        await this.gameRepository.updateGameCreator(
          gameId,
          fallbackSocket.data.userId,
        );

        server.to(room).emit('creator:changed', {
          newCreatorUserId: fallbackSocket.data.userId,
          newCreatorNickname:
            fallbackSocket.data.nickname ?? 'Jugador desconocido',
        });

        this.logger.log(
          `Nuevo creador asignado automáticamente: userId=${fallbackSocket.data.userId} para partida gameId=${gameId}`,
        );
      } else {
        this.logger.error(
          `No se encontró un socket válido para transferir liderazgo en gameId=${gameId}`,
        );
      }
    }
  }
}
