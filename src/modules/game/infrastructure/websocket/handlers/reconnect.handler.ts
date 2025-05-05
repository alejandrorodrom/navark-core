import { Injectable, Logger } from '@nestjs/common';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { BoardHandler } from './board.handler';
import { GameRepository } from '../../../domain/repository/game.repository';
import { SpectatorRepository } from '../../../domain/repository/spectator.repository';
import { GameSocketMapRedisRepository } from '../../repository/redis/game-socket-map.redis.repository';

@Injectable()
export class ReconnectHandler {
  private readonly logger = new Logger(ReconnectHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly spectatorRepository: SpectatorRepository,
    private readonly webSocketServerService: SocketServerAdapter,
    private readonly boardHandler: BoardHandler,
    private readonly gameSocketMapRedisRepository: GameSocketMapRedisRepository,
  ) {}

  /**
   * Maneja la reconexión de un jugador a una partida en progreso.
   * Reasigna el socket actual y reenvía estado visual.
   *
   * @param client Nuevo socket del jugador que se reconecta.
   */
  async handleReconnect(client: SocketWithUser): Promise<void> {
    const previousMapping =
      await this.gameSocketMapRedisRepository.getLastGameByUserId(
        client.data.userId,
      );

    if (!previousMapping) {
      this.logger.warn(
        `No se encontró mapping previo para userId=${client.data.userId}`,
      );
      client.emit('reconnect:failed', { reason: 'No estabas en una partida' });
      return;
    }

    const { gameId } = previousMapping;
    const room = `game:${gameId}`;

    const game = await this.gameRepository.findByIdWithPlayers(gameId);

    if (!game) {
      this.logger.warn(
        `Partida inexistente. No se puede reconectar. gameId=${gameId}`,
      );
      client.emit('reconnect:failed', { reason: 'Partida ya no existe' });
      return;
    }

    const [isPlayer, isSpectator] = [
      game.gamePlayers.some((p) => p.userId === client.data.userId),
      await this.spectatorRepository.findFirst(gameId, client.data.userId),
    ];

    if (!isPlayer) {
      this.logger.warn(
        `Reconexión rechazada: userId=${client.data.userId} no es jugador en gameId=${gameId}`,
      );
      client.emit('reconnect:failed', {
        reason: isSpectator
          ? 'Eres espectador, no puedes reconectarte como jugador'
          : 'No estás registrado en esta partida',
      });
      return;
    }

    if (!isPlayer) {
      this.logger.warn(
        `Intento de reconexión inválida: userId=${client.data.userId} no pertenece a gameId=${gameId}`,
      );
      client.emit('reconnect:failed', {
        reason: 'No estás registrado como jugador de esta partida',
      });
      return;
    }

    // Join a la sala y guardar nuevo socket mapping
    await client.join(room);
    await this.gameSocketMapRedisRepository.save(
      client.id,
      client.data.userId,
      gameId,
    );

    this.logger.log(
      `Jugador reconectado: userId=${client.data.userId}, gameId=${gameId}`,
    );

    // Reenviar estado visual
    await this.boardHandler.sendBoardUpdate(client, gameId);

    // Notificar al resto de la sala
    this.webSocketServerService
      .getServer()
      .to(room)
      .emit('player:reconnected', {
        userId: client.data.userId,
        nickname: client.data.nickname,
      });

    client.emit('reconnect:ack', { success: true });
  }
}
