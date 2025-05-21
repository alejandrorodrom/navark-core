import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * Servicio encargado de gestionar el estado nuclear de cada jugador en una partida.
 *
 * Utiliza Redis para persistir de forma rápida:
 * - El progreso hacia la bomba nuclear
 * - La disponibilidad de uso
 * - El uso final de la bomba
 */
@Injectable()
export class NuclearStateRedis {
  constructor(private readonly redisService: RedisService) {}

  /** Acceso directo al cliente Redis */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Incrementa el contador de disparos acertados hacia el desbloqueo nuclear.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns Nuevo valor del progreso
   */
  async incrementNuclearProgress(
    gameId: number,
    userId: number,
  ): Promise<number> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    return this.redis.incr(key);
  }

  /**
   * Reinicia el progreso nuclear del jugador a cero.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   */
  async resetNuclearProgress(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    await this.redis.del(key);
  }

  /**
   * Marca que el jugador ha desbloqueado la bomba nuclear.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   */
  async unlockNuclear(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:available`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si el jugador tiene la bomba nuclear disponible.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns `true` si está disponible, `false` en caso contrario
   */
  async hasNuclearAvailable(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:nuclear:${userId}:available`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Marca que el jugador ya usó la bomba nuclear.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   */
  async markNuclearUsed(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:used`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si el jugador ya utilizó su bomba nuclear.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns `true` si ya fue usada, `false` si aún no
   */
  async hasNuclearUsed(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:nuclear:${userId}:used`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Devuelve el progreso actual de disparos acertados hacia el desbloqueo nuclear.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns Número de aciertos acumulados
   */
  async getNuclearProgress(gameId: number, userId: number): Promise<number> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    const value = await this.redis.get(key);
    return value ? Number(value) : 0;
  }

  /**
   * Limpia todos los datos nucleares relacionados a una partida.
   *
   * Borra cualquier rastro de progreso, desbloqueo y uso nuclear.
   *
   * @param gameId ID de la partida
   */
  async clearNuclear(gameId: number): Promise<void> {
    const keys = await this.redis.keys(`game:${gameId}:nuclear:*`);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
