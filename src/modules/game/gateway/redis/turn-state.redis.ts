import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * TurnStateRedis maneja el estado del turno actual en Redis.
 * Incluye información sobre:
 * - De quién es el turno actual.
 * - Timeout activo de turno.
 * - Cantidad de turnos fallidos.
 */
@Injectable()
export class TurnStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Establece el jugador que tiene actualmente el turno en una partida.
   * @param gameId ID de la partida.
   * @param userId ID del usuario al que pertenece el turno.
   */
  async setCurrentTurn(gameId: number, userId: number): Promise<void> {
    await this.redis.set(`game:${gameId}:turn`, userId.toString());
  }

  /**
   * Obtiene el ID del jugador que tiene el turno actual.
   * @param gameId ID de la partida.
   * @returns ID del jugador o null si no existe.
   */
  async getCurrentTurn(gameId: number): Promise<number | null> {
    const value = await this.redis.get(`game:${gameId}:turn`);
    return value ? Number(value) : null;
  }

  /**
   * Borra el registro del turno actual de la partida.
   * @param gameId ID de la partida.
   */
  async clearTurn(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:turn`);
  }

  /**
   * Guarda en Redis el userId que debe disparar, para validar si pierde el turno.
   * @param gameId ID de la partida.
   * @param userId ID del usuario que debe actuar.
   */
  async setTurnTimeout(gameId: number, userId: number): Promise<void> {
    await this.redis.set(`game:${gameId}:turn:timeout`, userId.toString());
  }

  /**
   * Obtiene el userId que tiene un timeout activo de disparo.
   * @param gameId ID de la partida.
   * @returns ID del jugador esperado para disparar o null si no existe.
   */
  async getTurnTimeout(gameId: number): Promise<number | null> {
    const value = await this.redis.get(`game:${gameId}:turn:timeout`);
    return value ? Number(value) : null;
  }

  /**
   * Aumenta el contador de turnos fallidos para un jugador en la partida.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   * @returns Número total de turnos fallidos acumulados.
   */
  async incrementMissedTurns(gameId: number, userId: number): Promise<number> {
    const key = `game:${gameId}:missed:${userId}`;
    return this.redis.incr(key);
  }

  /**
   * Resetea a 0 el contador de turnos fallidos de un jugador.
   * @param gameId ID de la partida.
   * @param userId ID del jugador.
   */
  async resetMissedTurns(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:missed:${userId}`;
    await this.redis.del(key);
  }

  async clearTurnTimeout(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:turn:timeout`);
  }
}
