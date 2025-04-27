import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * ReadyStateRedis gestiona el estado de "listo" de los jugadores
 * en una partida multijugador utilizando Redis.
 */
@Injectable()
export class ReadyStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Marca a un jugador como "listo" en una partida.
   * @param gameId ID de la partida.
   * @param socketId ID del socket del jugador.
   */
  async setPlayerReady(gameId: number, socketId: string): Promise<void> {
    await this.redis.hset(`game:${gameId}:ready`, socketId, 'true');
  }

  /**
   * Obtiene la lista de todos los sockets que han marcado "listo" en una partida.
   * @param gameId ID de la partida.
   * @returns Array de socket IDs listos.
   */
  async getAllReady(gameId: number): Promise<string[]> {
    const all = await this.redis.hgetall(`game:${gameId}:ready`);
    return Object.keys(all ?? {});
  }

  /**
   * Verifica si un jugador específico está marcado como "listo".
   * @param gameId ID de la partida.
   * @param socketId ID del socket del jugador.
   * @returns `true` si el jugador está listo, de lo contrario `false`.
   */
  async isPlayerReady(gameId: number, socketId: string): Promise<boolean> {
    const value = await this.redis.hget(`game:${gameId}:ready`, socketId);
    return value === 'true';
  }

  /**
   * Limpia el estado de "listo" de todos los jugadores de una partida.
   * @param gameId ID de la partida.
   */
  async clearReady(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:ready`);
  }
}
