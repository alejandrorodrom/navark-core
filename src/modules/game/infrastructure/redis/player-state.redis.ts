import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * Servicio responsable de administrar el estado de abandono de jugadores en Redis.
 *
 * Un jugador marcado como "abandonado" ya no puede reconectarse a la partida.
 * Esto se aplica cuando:
 * - El jugador pierde conexión y excede el tiempo permitido
 * - El jugador acumula turnos sin acción
 * - El jugador abandona voluntariamente
 */
@Injectable()
export class PlayerStateRedis {
  constructor(private readonly redisService: RedisService) {}

  /** Acceso directo al cliente de Redis */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Marca a un jugador como "abandonado" en una partida específica.
   *
   * Este flag puede ser consultado para denegar la reconexión a esa partida.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns Promise<void>
   */
  async markAsAbandoned(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:abandoned:${userId}`;
    await this.redis.set(key, 'true');
  }

  /**
   * Verifica si un jugador ha sido marcado como abandonado en una partida.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   * @returns true si fue marcado como abandonado, false si no
   */
  async isAbandoned(gameId: number, userId: number): Promise<boolean> {
    const key = `game:${gameId}:abandoned:${userId}`;
    const value = await this.redis.get(key);
    return value === 'true';
  }

  /**
   * Elimina el estado de abandono de un jugador específico.
   *
   * Este método puede usarse si se revierte una expulsión.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   */
  async clearAbandoned(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:abandoned:${userId}`;
    await this.redis.del(key);
  }

  /**
   * Limpia el estado de abandono de todos los jugadores de una partida.
   *
   * Este método debe ejecutarse cuando una partida finaliza o se reinicia.
   *
   * @param gameId ID de la partida
   */
  async clearAllAbandoned(gameId: number): Promise<void> {
    const keys = await this.redis.keys(`game:${gameId}:abandoned:*`);
    if (keys.length) {
      await this.redis.del(...keys);
    }
  }
}
