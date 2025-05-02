import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from './turn-state.redis';
import { ReadyStateRedis } from './ready-state.redis';
import { TeamStateRedis } from './team-state.redis';
import { NuclearStateRedis } from './nuclear-state.redis';
import { RedisService } from '../../../../redis/redis.service';

@Injectable()
export class GameRedisStateService {
  private readonly logger = new Logger(GameRedisStateService.name);

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamsStateRedis: TeamStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly redisService: RedisService,
  ) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Limpia todos los estados relacionados a una partida en Redis.
   */
  async clearGameRedisState(gameId: number): Promise<void> {
    await Promise.all([
      this.readyStateRedis.clearReady(gameId),
      this.teamsStateRedis.clearTeams(gameId),
      this.turnStateRedis.clearTurn(gameId),
      this.nuclearStateRedis.clearNuclear(gameId),
    ]);

    this.logger.log(
      `Limpieza de estado Redis completada para partida ${gameId}`,
    );
  }

  /**
   * Guarda el mapeo de un socket conectado (userId y gameId).
   */
  async saveSocketMapping(
    socketId: string,
    userId: number,
    gameId: number,
  ): Promise<void> {
    await this.redis.set(
      `socket:${socketId}`,
      JSON.stringify({ userId, gameId }),
    );
  }

  /**
   * Obtiene el mapeo de un socket (userId y gameId).
   */
  async getSocketMapping(
    socketId: string,
  ): Promise<{ userId: number; gameId: number } | null> {
    const data = await this.redis.get(`socket:${socketId}`);
    return data
      ? (JSON.parse(data) as { userId: number; gameId: number })
      : null;
  }

  /**
   * Elimina el mapeo de un socket desconectado.
   */
  async deleteSocketMapping(socketId: string): Promise<void> {
    await this.redis.del(`socket:${socketId}`);
  }

  async getLastGameMappingByUserId(
    userId: number,
  ): Promise<{ gameId: number } | null> {
    const key = `lastGameByUser:${userId}`;
    const gameId = await this.redis.get(key);
    return gameId ? { gameId: Number(gameId) } : null;
  }
}
