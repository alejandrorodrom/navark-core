import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * Servicio encargado de gestionar el estado de "listo" de los jugadores
 * dentro de una sala de espera en partidas multijugador.
 *
 * Se usa Redis como almacenamiento rápido utilizando una hash por partida:
 * - Clave: `game:{gameId}:ready`
 * - Campo: socketId del jugador
 * - Valor: 'true' si está listo
 */
@Injectable()
export class ReadyStateRedis {
  constructor(private readonly redisService: RedisService) {}

  /** Acceso directo al cliente Redis */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Marca a un jugador como "listo" en Redis, usando su socketId como identificador.
   *
   * @param gameId ID de la partida
   * @param socketId ID del socket del jugador
   * @returns Promise<void>
   */
  async setPlayerReady(gameId: number, socketId: string): Promise<void> {
    await this.redis.hset(`game:${gameId}:ready`, socketId, 'true');
  }

  /**
   * Obtiene la lista de todos los jugadores (por socketId) que están listos.
   *
   * Esta función es útil para verificar si todos los jugadores han confirmado
   * estar listos antes de iniciar la partida.
   *
   * @param gameId ID de la partida
   * @returns Array de socketIds marcados como "listo"
   */
  async getAllReady(gameId: number): Promise<string[]> {
    const all = await this.redis.hgetall(`game:${gameId}:ready`);
    return Object.keys(all ?? {});
  }

  /**
   * Verifica si un jugador está marcado como "listo" dentro de una partida.
   *
   * @param gameId ID de la partida
   * @param socketId ID del socket del jugador
   * @returns `true` si el jugador está listo, `false` en caso contrario
   */
  async isPlayerReady(gameId: number, socketId: string): Promise<boolean> {
    const value = await this.redis.hget(`game:${gameId}:ready`, socketId);
    return value === 'true';
  }

  /**
   * Elimina todos los registros de jugadores listos en una partida.
   *
   * Se ejecuta al finalizar o resetear una sala de espera.
   *
   * @param gameId ID de la partida
   */
  async clearReady(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:ready`);
  }
}
