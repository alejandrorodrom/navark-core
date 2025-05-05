import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../../redis/redis.service';

/**
 * GameSocketMapRedisRepository gestiona los mapeos temporales
 * entre socketId, userId y gameId dentro del contexto de partidas activas.
 */
@Injectable()
export class GameSocketMapRedisRepository {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  async save(socketId: string, userId: number, gameId: number): Promise<void> {
    await this.redis.set(
      `socket:${socketId}`,
      JSON.stringify({ userId, gameId }),
    );
  }

  async get(
    socketId: string,
  ): Promise<{ userId: number; gameId: number } | null> {
    const data = await this.redis.get(`socket:${socketId}`);
    return data
      ? (JSON.parse(data) as { userId: number; gameId: number })
      : null;
  }

  async delete(socketId: string): Promise<void> {
    await this.redis.del(`socket:${socketId}`);
  }

  async getLastGameByUserId(
    userId: number,
  ): Promise<{ gameId: number } | null> {
    const key = `lastGameByUser:${userId}`;
    const gameId = await this.redis.get(key);
    return gameId ? { gameId: Number(gameId) } : null;
  }
}
