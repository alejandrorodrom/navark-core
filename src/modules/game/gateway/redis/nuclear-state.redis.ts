import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * NuclearStateRedis gestiona el estado relacionado a la bomba nuclear
 * para cada jugador en una partida, utilizando Redis como almacenamiento rápido.
 */
@Injectable()
export class NuclearStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Incrementa el contador de progresos hacia desbloquear la bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns Nuevo valor del progreso tras incrementar.
   */
  async incrementNuclearProgress(
    gameId: number,
    userId: number,
  ): Promise<number> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    return this.redis.incr(key);
  }

  /**
   * Resetea el contador de progresos de bomba nuclear para un jugador.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async resetNuclearProgress(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    await this.redis.del(key);
  }

  /**
   * Marca que un jugador ha desbloqueado la bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async unlockNuclear(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:available`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si un jugador ha desbloqueado la bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns `true` si la bomba está disponible, de lo contrario `false`.
   */
  async hasNuclearAvailable(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:nuclear:${userId}:available`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Marca que un jugador ya utilizó su bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async markNuclearUsed(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:nuclear:${userId}:used`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si un jugador ya usó su bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns `true` si ya la usó, de lo contrario `false`.
   */
  async hasNuclearUsed(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:nuclear:${userId}:used`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Obtiene el progreso actual de disparos acertados de un jugador
   * hacia el desbloqueo de la bomba nuclear.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns Progreso actual (número de aciertos).
   */
  async getNuclearProgress(gameId: number, userId: number): Promise<number> {
    const key = `game:${gameId}:nuclear:${userId}:progress`;
    const value = await this.redis.get(key);
    return value ? Number(value) : 0;
  }

  /**
   * Limpia completamente todos los datos nucleares asociados a una partida.
   * @param gameId ID de la partida.
   */
  async clearNuclear(gameId: number): Promise<void> {
    const keys = await this.redis.keys(`game:${gameId}:nuclear:*`);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
