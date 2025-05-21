import { Injectable, Logger } from '@nestjs/common';
import { RedisCleanerOrchestrator } from '../../orchestrators/redis-cleaner.orchestrator';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameEvents } from '../events/constants/game-events.enum';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { EventPayload } from '../events/types/events-payload.type';

/**
 * Servicio especializado en gestionar la salida de jugadores de partidas en curso,
 * implementando lógica para el manejo de escenarios como:
 *
 * - Notificación a otros participantes sobre la salida
 * - Reasignación automática del rol de creador si el creador original abandona
 * - Limpieza de recursos y eliminación de partidas que quedan vacías
 * - Registro de actividades para auditoría y diagnóstico
 *
 * Este servicio garantiza la integridad de las partidas cuando los jugadores
 * deciden abandonarlas voluntariamente o se desconectan.
 */
@Injectable()
export class LeaveHandler {
  private readonly logger = new Logger(LeaveHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly redisUtils: RedisCleanerOrchestrator,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Procesa la solicitud de un jugador para abandonar voluntariamente una partida.
   *
   * El método ejecuta un flujo completo que incluye:
   * 1. Notificación a todos los participantes sobre la salida del jugador
   * 2. Desvinculación del socket de la sala de juego
   * 3. Verificación del estado de la partida tras la salida
   * 4. Eliminación de partidas vacías y liberación de recursos
   * 5. Reasignación automática del rol de creador si es necesario
   *
   * Este proceso es fundamental para mantener la continuidad del juego
   * cuando algunos jugadores deciden retirarse mientras la partida sigue activa.
   *
   * @param client Socket del cliente que solicita abandonar la partida
   * @param data Objeto con el ID de la partida que desea abandonar
   * @returns Promesa que se resuelve cuando todo el proceso ha sido completado
   */
  async onPlayerLeave(
    client: SocketWithUser,
    data: EventPayload<GameEvents.PLAYER_LEAVE>,
  ): Promise<void> {
    const gameId = data.gameId;
    const userId = client.data.userId;
    const nickname = client.data.nickname || 'Jugador desconocido';

    try {
      this.logger.log(
        `Jugador socketId=${client.id} (userId=${userId}) solicitó abandonar partida gameId=${gameId}`,
      );

      // 1. Notificar al resto de jugadores
      this.gameEventEmitter.emitPlayerLeft(gameId, userId, nickname);

      // 2. Desvincular al jugador de la sala (WebSocket leave room)
      await this.socketServerAdapter.leaveGameRoom(client.id, gameId);

      // 3. Verificar que la partida exista en base de datos
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        this.logger.warn(
          `No se encontró partida en base de datos al intentar abandonar: gameId=${gameId}`,
        );
        return;
      }

      // 4. Obtener sockets restantes en la sala
      const remainingSocketIds =
        this.socketServerAdapter.getSocketsInGame(gameId);

      // 5. Si no queda nadie, eliminar la partida
      if (remainingSocketIds.length === 0) {
        this.logger.log(
          `La partida gameId=${gameId} quedó vacía tras la salida. Eliminando partida...`,
        );

        // Notificar abandono global
        this.gameEventEmitter.emitGameAbandoned(gameId);

        // Expulsar cualquier remanente por seguridad (aunque no deberían existir)
        for (const socketId of remainingSocketIds) {
          this.gameEventEmitter.emitPlayerKicked(
            socketId,
            'Partida abandonada',
          );
        }

        // Eliminar de base de datos y Redis
        await this.gameRepository.removeAbandonedGames(gameId);
        await this.redisUtils.clearGameRedisState(gameId);

        this.logger.log(`Partida gameId=${gameId} eliminada exitosamente.`);
        return;
      }

      // 6. Si el jugador era el creador, asignar nuevo líder automáticamente
      if (game.createdById === userId) {
        this.logger.warn(
          `El creador abandonó la partida gameId=${gameId}. Buscando nuevo creador...`,
        );

        const fallbackSocketId = remainingSocketIds[0];
        const fallbackUserData =
          this.socketServerAdapter.getSocketUserData(fallbackSocketId);

        if (fallbackUserData) {
          await this.gameRepository.updateGameCreator(
            gameId,
            fallbackUserData.userId,
          );

          this.gameEventEmitter.emitCreatorChanged(
            gameId,
            fallbackUserData.userId,
            fallbackUserData.nickname,
          );

          this.logger.log(
            `Nuevo creador asignado automáticamente: userId=${fallbackUserData.userId} para partida gameId=${gameId}`,
          );
        } else {
          this.logger.error(
            `No se encontró un socket válido para transferir liderazgo en gameId=${gameId}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar salida de jugador: gameId=${gameId}, userId=${userId}, error=${error}`,
      );
    }
  }
}
