import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * TurnStateRedis gestiona el turno actual de cada partida en Redis.
 */
@Injectable()
export class TurnStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Establece el usuario que tiene el turno actual en una partida.
   * @param gameId ID de la partida.
   * @param userId ID del usuario que tendrá el turno.
   */
  async setCurrentTurn(gameId: number, userId: number): Promise<void> {
    await this.redis.set(`game:${gameId}:turn`, userId.toString());
  }

  /**
   * Obtiene el ID del usuario que tiene el turno actual en una partida.
   * @param gameId ID de la partida.
   * @returns ID del usuario que tiene el turno o `null` si no existe.
   */
  async getCurrentTurn(gameId: number): Promise<number | null> {
    const value = await this.redis.get(`game:${gameId}:turn`);
    return value ? Number(value) : null;
  }

  /**
   * Elimina el turno actual almacenado para una partida.
   * @param gameId ID de la partida.
   */
  async clearTurn(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:turn`);
  }
}
