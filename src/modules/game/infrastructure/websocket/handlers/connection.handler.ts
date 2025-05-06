import { Injectable, Logger } from '@nestjs/common';
import { LobbyManagerService } from '../../services/game/lobby/lobby-manager.service';
import { RedisCleanerService } from '../../services/game/cleanup/redis-cleaner.service';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameSocketMapRedisRepository } from '../../repository/redis/game-socket-map.redis.repository';
import { GameEvents } from '../events/constants/game-events.enum';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';

/**
 * Servicio responsable de gestionar los ciclos de vida de las conexiones WebSocket
 * para las sesiones de juego multijugador en tiempo real.
 *
 * Este componente crítico de la infraestructura se encarga de:
 * - Registrar nuevas conexiones de clientes
 * - Procesar las desconexiones inesperadas o voluntarias
 * - Mantener la integridad de las partidas cuando los jugadores se desconectan
 * - Reasignar roles de administración (creador) cuando es necesario
 * - Eliminar partidas abandonadas para liberar recursos
 *
 * El manejo adecuado de conexiones es esencial para proporcionar una
 * experiencia robusta y resiliente en un entorno de juego en línea.
 */
@Injectable()
export class ConnectionHandler {
  private readonly logger = new Logger(ConnectionHandler.name);

  constructor(
    private readonly lobbyManager: LobbyManagerService,
    private readonly redisCleanerService: RedisCleanerService,
    private readonly gameRepository: GameRepository,
    private readonly gameSocketMapRedisRepository: GameSocketMapRedisRepository,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Registra y procesa la conexión inicial de un cliente WebSocket al servidor.
   *
   * Esta función se ejecuta automáticamente cuando un cliente establece
   * una nueva conexión WebSocket con el servidor de juego. En este punto,
   * el cliente aún no está asociado a ninguna partida específica.
   *
   * @param client Objeto socket del cliente recién conectado, que incluye
   *               datos de identificación y autenticación
   */
  handleConnection(client: SocketWithUser): void {
    const userId = client.data?.userId || 'anónimo';
    const nickname = client.data?.nickname || 'Visitante';

    this.logger.log(
      `Cliente conectado: socketId=${client.id}, userId=${userId}, nickname=${nickname}`,
    );
  }

  /**
   * Gestiona de forma integral la desconexión de un cliente del servidor WebSocket.
   *
   * Esta función es crucial para mantener la integridad del juego cuando los jugadores
   * se desconectan (ya sea por cierre voluntario, problemas de red, etc.). Realiza
   * las siguientes operaciones vitales:
   *
   * 1. Identifica la partida a la que pertenecía el cliente desconectado
   * 2. Notifica a los demás jugadores sobre la desconexión
   * 3. Elimina registros de mapeo del socket en Redis
   * 4. Si era el creador, transfiere los privilegios a otro jugador
   * 5. Si era el último jugador, marca la partida como abandonada y libera recursos
   *
   * El manejo correcto de las desconexiones evita partidas "zombies" y garantiza
   * que los recursos del servidor se liberen adecuadamente cuando ya no son necesarios.
   *
   * @param client Objeto socket del cliente que se ha desconectado
   * @returns Promesa que se resuelve cuando se han completado todas las operaciones de limpieza
   */
  async handleDisconnect(client: SocketWithUser): Promise<void> {
    const userId = client.data?.userId || 'no autenticado';
    const nickname = client.data?.nickname || 'Desconocido';

    this.logger.log(
      `Cliente desconectado: socketId=${client.id}, userId=${userId}, nickname=${nickname}`,
    );

    try {
      // Obtener el mapeo de este socket a una partida específica
      const mapping = await this.gameSocketMapRedisRepository.get(client.id);

      if (!mapping) {
        this.logger.warn(
          `No se encontró mapeo para socketId=${client.id}. El cliente no estaba en ninguna partida.`,
        );
        return;
      }

      const { gameId, userId } = mapping;

      this.logger.log(
        `Procesando desconexión de partida: gameId=${gameId}, userId=${userId}, socketId=${client.id}`,
      );

      // Eliminar el mapeo del socket en Redis
      await this.gameSocketMapRedisRepository.delete(client.id);
      this.logger.debug(`Mapeo eliminado de Redis para socketId=${client.id}`);

      // Verificar que la partida exista en la base de datos
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        this.logger.warn(
          `Partida inexistente en base de datos: gameId=${gameId}. Omitiendo proceso de desconexión.`,
        );
        return;
      }

      // Notificar a todos los clientes en la sala sobre la desconexión
      this.gameEventEmitter.emitPlayerLeft(
        gameId,
        userId,
        client.data.nickname || 'Jugador desconocido',
      );

      // Verificar si la sala ha quedado vacía
      const allSocketIds = this.socketServerAdapter.getSocketsInGame(gameId);
      const remainingSocketIds = allSocketIds.filter((id) => id !== client.id);

      this.logger.debug(
        `Estado de la sala: gameId=${gameId}, jugadores restantes=${remainingSocketIds.length}`,
      );

      // Si no quedan jugadores, eliminar la partida y liberar recursos
      if (remainingSocketIds.length === 0) {
        this.logger.warn(
          `Partida vacía detectada. Iniciando proceso de eliminación para gameId=${gameId}.`,
        );

        // Emitir evento de juego abandonado y expulsar a todos los jugadores
        this.gameEventEmitter.emitGameAbandoned(gameId);
        await this.lobbyManager.kickPlayersFromRoom(gameId);

        // Eliminar datos de la partida tanto en BD como en Redis
        await Promise.all([
          this.gameRepository.removeAbandonedGames(gameId),
          this.redisCleanerService.clearGameRedisState(gameId),
        ]);

        this.logger.log(
          `Partida gameId=${gameId} eliminada correctamente por abandono.`,
        );
        return;
      }

      // Si el jugador desconectado era el creador, reasignar el rol a otro jugador
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
   * Maneja la desconexión del creador de la partida, transfiriendo el rol a otro jugador
   *
   * @param gameId ID de la partida
   * @param remainingSocketIds Lista de IDs de sockets que permanecen en la partida
   * @param disconnectedUserId ID del usuario que se desconectó (el creador)
   * @private
   */
  private async handleCreatorDisconnection(
    gameId: number,
    remainingSocketIds: string[],
    disconnectedUserId: number,
  ): Promise<void> {
    this.logger.warn(
      `Creador (userId=${disconnectedUserId}) desconectado. Buscando nuevo creador para gameId=${gameId}.`,
    );

    // Seleccionar el primer socket disponible como nuevo creador
    const fallbackSocketId = remainingSocketIds[0];
    if (!fallbackSocketId) {
      this.logger.error(
        `No hay sockets restantes para transferir rol de creador en gameId=${gameId}`,
      );
      return;
    }

    const socketUserData =
      this.socketServerAdapter.getSocketUserData(fallbackSocketId);

    if (!socketUserData) {
      this.logger.error(
        `Error al reasignar creador: No se encontraron datos de usuario para socketId=${fallbackSocketId}`,
      );
      return;
    }

    const { userId, nickname } = socketUserData;

    try {
      // Actualizar el creador en la base de datos
      await this.gameRepository.updateGameCreator(gameId, userId);

      // Notificar a todos los jugadores sobre el cambio de creador
      this.gameEventEmitter.emitCreatorChanged(gameId, userId, nickname);

      this.logger.log(
        `Nuevo creador asignado automáticamente: userId=${userId}, nickname=${nickname} para gameId=${gameId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al transferir rol de creador en gameId=${gameId}`,
        error,
      );
    }
  }
}
