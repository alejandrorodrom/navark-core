import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * PlayerStateRedis gestiona información individual de jugadores,
 * como abandono de la partida (por inactividad u otros motivos).
 */
@Injectable()
export class PlayerStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Marca a un jugador como "abandonado" en una partida.
   * Esto impide que pueda volver a reconectarse como jugador.
   *
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async markAsAbandoned(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:abandoned:${userId}`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si un jugador ha sido marcado como "abandonado" en una partida.
   *
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns `true` si fue abandonado, `false` en caso contrario.
   */
  async isAbandoned(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:abandoned:${userId}`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Elimina el estado de abandono de un jugador (opcional).
   *
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async clearAbandoned(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:abandoned:${userId}`;
    await this.redis.del(key);
  }

  /**
   * Limpia el estado de abandono de todos los jugadores de una partida.
   * Usado al terminar o resetear una partida.
   *
   * @param gameId ID de la partida.
   */
  async clearAllAbandoned(gameId: number): Promise<void> {
    const keys = await this.redis.keys(`game:${gameId}:abandoned:*`);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
