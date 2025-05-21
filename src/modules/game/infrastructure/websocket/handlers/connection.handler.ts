import { Injectable, Logger } from '@nestjs/common';
import { LobbyManager } from '../../managers/lobby.manager';
import { RedisCleanerOrchestrator } from '../../orchestrators/redis-cleaner.orchestrator';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameSocketMapRedisRepository } from '../../repository/redis/game-socket-map.redis.repository';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';

/**
 * Servicio encargado de gestionar las conexiones y desconexiones de jugadores en WebSocket.
 *
 * Se encarga de:
 * - Registrar nuevas conexiones.
 * - Procesar desconexiones inesperadas.
 * - Eliminar partidas vacías.
 * - Transferir el rol de creador si es necesario.
 */
@Injectable()
export class ConnectionHandler {
  private readonly logger = new Logger(ConnectionHandler.name);

  constructor(
    private readonly lobbyManager: LobbyManager,
    private readonly redisCleanerService: RedisCleanerOrchestrator,
    private readonly gameRepository: GameRepository,
    private readonly gameSocketMapRedisRepository: GameSocketMapRedisRepository,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Registra una nueva conexión de un jugador al servidor WebSocket.
   *
   * @param client Socket del jugador recién conectado
   */
  handleConnection(client: SocketWithUser): void {
    const userId = client.data?.userId || 'anónimo';
    const nickname = client.data?.nickname || 'Visitante';

    this.logger.log(
      `Cliente conectado: socketId=${client.id}, userId=${userId}, nickname=${nickname}`,
    );
  }

  /**
   * Gestiona la desconexión de un jugador del servidor.
   * Se encarga de verificar su partida, notificar a los demás, y reasignar el rol de creador si aplica.
   *
   * @param client Socket del jugador desconectado
   */
  async handleDisconnect(client: SocketWithUser): Promise<void> {
    const userId = client.data?.userId || 'no autenticado';
    const nickname = client.data?.nickname || 'Desconocido';

    this.logger.log(
      `Cliente desconectado: socketId=${client.id}, userId=${userId}, nickname=${nickname}`,
    );

    try {
      // 1. Obtener mapeo socket ↔ user/game
      const mapping = await this.gameSocketMapRedisRepository.get(client.id);
      if (!mapping) {
        this.logger.warn(`No se encontró mapeo para socketId=${client.id}.`);
        return;
      }

      const { gameId, userId } = mapping;

      this.logger.log(
        `Procesando desconexión: gameId=${gameId}, userId=${userId}`,
      );

      // 2. Eliminar mapeo de Redis
      await this.gameSocketMapRedisRepository.delete(client.id);
      this.logger.debug(`Mapeo eliminado: socketId=${client.id}`);

      // 3. Obtener datos de la partida
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        this.logger.warn(`Partida gameId=${gameId} no encontrada.`);
        return;
      }

      // 4. Notificar desconexión al resto
      this.gameEventEmitter.emitPlayerLeft(
        gameId,
        userId,
        client.data.nickname || 'Jugador desconocido',
      );

      // 5. Verificar si hay sockets restantes en la sala
      const allSocketIds = this.socketServerAdapter.getSocketsInGame(gameId);
      const remainingSocketIds = allSocketIds.filter((id) => id !== client.id);

      this.logger.debug(
        `Sala gameId=${gameId}, sockets restantes=${remainingSocketIds.length}`,
      );

      // 6. Si no queda nadie, eliminar la partida
      if (remainingSocketIds.length === 0) {
        this.logger.warn(
          `Partida vacía detectada. Eliminando gameId=${gameId}`,
        );

        await Promise.all([
          this.gameRepository.removeAbandonedGames(gameId),
          this.redisCleanerService.clearGameRedisState(gameId),
          this.lobbyManager.kickPlayersFromRoom(gameId),
        ]);

        this.logger.log(`Partida gameId=${gameId} eliminada por abandono.`);
        return;
      }

      // 7. Si el jugador era el creador, reasignar creador
      if (game.createdById === userId) {
        await this.handleCreatorDisconnection(
          gameId,
          remainingSocketIds,
          userId,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar desconexión para socketId=${client.id}`,
        error,
      );
    }
  }

  /**
   * Reasigna el rol de creador si el jugador desconectado era el creador original.
   *
   * @param gameId ID de la partida
   * @param remainingSocketIds Lista de sockets restantes en la sala
   * @param disconnectedUserId ID del usuario que se desconectó
   * @private
   */
  private async handleCreatorDisconnection(
    gameId: number,
    remainingSocketIds: string[],
    disconnectedUserId: number,
  ): Promise<void> {
    this.logger.warn(
      `Creador desconectado (userId=${disconnectedUserId}). Buscando nuevo creador para gameId=${gameId}`,
    );

    const fallbackSocketId = remainingSocketIds[0];
    if (!fallbackSocketId) {
      this.logger.error(
        `No hay sockets restantes para transferir el rol de creador.`,
      );
      return;
    }

    const socketUserData =
      this.socketServerAdapter.getSocketUserData(fallbackSocketId);

    if (!socketUserData) {
      this.logger.error(
        `No se pudo obtener datos del nuevo creador (socketId=${fallbackSocketId})`,
      );
      return;
    }

    const { userId, nickname } = socketUserData;

    try {
      await this.gameRepository.updateGameCreator(gameId, userId);
      this.gameEventEmitter.emitCreatorChanged(gameId, userId, nickname);

      this.logger.log(
        `Nuevo creador asignado: userId=${userId}, nickname=${nickname}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al reasignar el rol de creador para gameId=${gameId}`,
        error,
      );
    }
  }
}
