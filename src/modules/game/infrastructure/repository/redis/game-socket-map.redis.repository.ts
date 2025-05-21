import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../../redis/redis.service';

/**
 * GameSocketMapRedisRepository gestiona los mapeos temporales
 * entre `socketId`, `userId` y `gameId` durante el ciclo de vida de una partida.
 *
 * Este repositorio permite:
 * - Asociar un socket a un jugador y una partida
 * - Recuperar esta asociación
 * - Eliminarla al desconectar
 * - Consultar la última partida activa por usuario
 */
@Injectable()
export class GameSocketMapRedisRepository {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Guarda la relación entre un `socketId`, `userId` y `gameId`.
   *
   * @param socketId ID único del socket conectado
   * @param userId ID del usuario autenticado
   * @param gameId ID de la partida en la que está participando
   */
  async save(socketId: string, userId: number, gameId: number): Promise<void> {
    await this.redis.set(
      `socket:${socketId}`,
      JSON.stringify({ userId, gameId }),
    );
  }

  /**
   * Recupera la relación socket-usuario-partida asociada a un `socketId`.
   *
   * @param socketId ID del socket del jugador
   * @returns Objeto con `userId` y `gameId`, o `null` si no existe
   */
  async get(
    socketId: string,
  ): Promise<{ userId: number; gameId: number } | null> {
    const data = await this.redis.get(`socket:${socketId}`);
    return data
      ? (JSON.parse(data) as { userId: number; gameId: number })
      : null;
  }

  /**
   * Elimina la asociación de un `socketId`, comúnmente usada al desconectar.
   *
   * @param socketId ID del socket que se va a limpiar
   */
  async delete(socketId: string): Promise<void> {
    await this.redis.del(`socket:${socketId}`);
  }

  /**
   * Devuelve la última partida a la que estuvo conectado un usuario.
   * Esto puede utilizarse para lógica de reconexión.
   *
   * @param userId ID del usuario
   * @returns Objeto con `gameId` si existe, o `null`
   */
  async getLastGameByUserId(
    userId: number,
  ): Promise<{ gameId: number } | null> {
    const key = `lastGameByUser:${userId}`;
    const gameId = await this.redis.get(key);
    return gameId ? { gameId: Number(gameId) } : null;
  }
}
