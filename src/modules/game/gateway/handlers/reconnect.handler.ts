import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { RedisUtils } from '../utils/redis.utils';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { SocketWithUser } from '../contracts/socket.types';
import { BoardHandler } from './board.handler';

@Injectable()
export class ReconnectHandler {
  private readonly logger = new Logger(ReconnectHandler.name);

  constructor(
    private readonly redisUtils: RedisUtils,
    private readonly prisma: PrismaService,
    private readonly webSocketServerService: WebSocketServerService,
    private readonly boardHandler: BoardHandler,
  ) {}

  /**
   * Maneja la reconexión de un jugador a una partida en progreso.
   * Reasigna el socket actual y reenvía estado visual.
   *
   * @param client Nuevo socket del jugador que se reconecta.
   */
  async handleReconnect(client: SocketWithUser): Promise<void> {
    const previousMapping = await this.redisUtils.getLastGameMappingByUserId(
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

    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { gamePlayers: true },
    });

    if (!game) {
      this.logger.warn(
        `Partida inexistente. No se puede reconectar. gameId=${gameId}`,
      );
      client.emit('reconnect:failed', { reason: 'Partida ya no existe' });
      return;
    }

    const [isPlayer, isSpectator] = [
      game.gamePlayers.some((p) => p.userId === client.data.userId),
      await this.prisma.spectator.findFirst({
        where: { gameId, userId: client.data.userId },
      }),
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
    await this.redisUtils.saveSocketMapping(
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
