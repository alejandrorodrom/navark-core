import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { BoardHandler } from './board.handler';
import { GameRepository } from '../../../domain/repository/game.repository';
import { SpectatorRepository } from '../../../domain/repository/spectator.repository';
import { GameSocketMapRedisRepository } from '../../repository/redis/game-socket-map.redis.repository';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { PlayerStateRedis } from '../../redis/player-state.redis';

/**
 * Servicio especializado en la gestión de reconexiones de jugadores que se desconectaron
 * temporalmente de una partida en curso, permitiendo que puedan reincorporarse sin perder
 * su progreso o posición en el juego.
 *
 * Este servicio implementa una lógica robusta para:
 * - Verificar si el usuario estaba previamente en una partida activa
 * - Validar que el usuario tenga permisos para reconectarse como jugador
 * - Restaurar el estado visual del tablero tras la reconexión
 * - Notificar a otros participantes sobre la reincorporación del jugador
 *
 * La funcionalidad de reconexión es crucial para mantener la experiencia de juego
 * ante problemas temporales de conectividad de los jugadores.
 */
@Injectable()
export class ReconnectHandler {
  private readonly logger = new Logger(ReconnectHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly spectatorRepository: SpectatorRepository,
    private readonly boardHandler: BoardHandler,
    private readonly gameSocketMapRedisRepository: GameSocketMapRedisRepository,
    private readonly gameEventEmitter: GameEventEmitter,
    private readonly playerStateRedis: PlayerStateRedis,
    private readonly socketServerAdapter: SocketServerAdapter,
  ) {}

  /**
   * Procesa la solicitud de reconexión de un jugador a una partida en curso.
   *
   * Este método implementa un flujo completo que incluye:
   * 1. Verificación de que el jugador estaba previamente en una partida
   * 2. Validación de que la partida sigue activa y el usuario tiene acceso
   * 3. Reasignación del nuevo socket a la sala correspondiente
   * 4. Actualización de los mapeos de socket-juego en Redis
   * 5. Restauración del estado visual del tablero para el jugador reconectado
   * 6. Notificación a todos los participantes sobre la reconexión
   *
   * El proceso incluye múltiples validaciones para garantizar una reconexión
   * segura y consistente con el estado actual del juego.
   *
   * @param client Nuevo socket del jugador que intenta reconectarse
   */
  async handleReconnect(client: SocketWithUser): Promise<void> {
    const userId = client.data.userId;
    const nickname = client.data.nickname || 'Jugador desconocido';

    try {
      // 1. Buscar el último mapping de partida asociado al userId
      const previousMapping =
        await this.gameSocketMapRedisRepository.getLastGameByUserId(userId);

      if (!previousMapping) {
        this.logger.warn(`No se encontró mapping previo para userId=${userId}`);
        this.gameEventEmitter.emitReconnectFailed(
          client.id,
          'No estabas en una partida',
        );
        return;
      }

      const { gameId } = previousMapping;

      // 2. Verificar existencia de la partida
      const game = await this.gameRepository.findByIdWithPlayers(gameId);
      if (!game) {
        this.logger.warn(
          `Partida inexistente. No se puede reconectar. gameId=${gameId}`,
        );
        this.gameEventEmitter.emitReconnectFailed(
          client.id,
          'Partida ya no existe',
        );
        return;
      }

      // 3. Verificar si el jugador fue expulsado
      const isAbandoned = await this.playerStateRedis.isAbandoned(
        gameId,
        userId,
      );
      if (isAbandoned) {
        this.logger.warn(
          `Reconexión denegada: jugador abandono previamente la partida`,
        );
        this.gameEventEmitter.emitReconnectFailed(
          client.id,
          'No puedes reconectarte a esta partida porque fuiste expulsado',
        );
        return;
      }

      // 4. Verificar si es jugador registrado o espectador
      const [isPlayer, isSpectator] = [
        game.gamePlayers.some((p) => p.userId === userId),
        await this.spectatorRepository.findFirst(gameId, userId),
      ];

      if (!isPlayer) {
        this.logger.warn(
          `Reconexión rechazada: userId=${userId} no es jugador en gameId=${gameId}`,
        );
        this.gameEventEmitter.emitReconnectFailed(
          client.id,
          isSpectator
            ? 'Eres espectador, no puedes reconectarte como jugador'
            : 'No estás registrado en esta partida',
        );
        return;
      }

      // 5. Reasignar socket al room de juego
      await this.socketServerAdapter.joinGameRoom(client.id, gameId);

      // 6. Actualizar mapeo de socket y usuario en Redis
      await this.gameSocketMapRedisRepository.save(client.id, userId, gameId);

      this.logger.log(
        `Jugador reconectado: userId=${userId}, gameId=${gameId}`,
      );

      // 7. Restaurar estado visual del tablero para el jugador
      await this.boardHandler.sendBoardUpdate(client, gameId);

      // 8. Notificar a la sala sobre la reconexión
      this.gameEventEmitter.emitPlayerReconnected(gameId, userId, nickname);

      // 9. Confirmar reconexión al cliente
      this.gameEventEmitter.emitReconnectAck(client.id, true);
    } catch (error) {
      this.logger.error(
        `Error en reconexión de jugador: userId=${userId}, error=${error}`,
      );
      this.gameEventEmitter.emitReconnectFailed(
        client.id,
        'Error interno al procesar la reconexión',
      );
    }
  }
}
