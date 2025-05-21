import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * Servicio encargado de gestionar el estado del turno en Redis.
 *
 * Controla:
 * - Qué jugador tiene el turno actual.
 * - Quién tiene un timeout de disparo activo.
 * - Cuántos turnos ha fallado un jugador (por inactividad).
 *
 * Este servicio permite mantener la lógica del turno sincronizada incluso
 * en escenarios distribuidos (múltiples servidores o procesos).
 */
@Injectable()
export class TurnStateRedis {
  constructor(private readonly redisService: RedisService) {}

  /** Acceso directo al cliente Redis */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Establece en Redis qué jugador tiene actualmente el turno.
   *
   * Se guarda como: `game:{gameId}:turn` = userId
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador al que se le asigna el turno
   * @returns Promise<void>
   */
  async setCurrentTurn(gameId: number, userId: number): Promise<void> {
    await this.redis.set(`game:${gameId}:turn`, userId.toString());
  }

  /**
   * Obtiene el ID del jugador que tiene el turno actual.
   *
   * @param gameId ID de la partida
   * @returns userId del jugador o `null` si no hay valor
   */
  async getCurrentTurn(gameId: number): Promise<number | null> {
    const value = await this.redis.get(`game:${gameId}:turn`);
    return value ? Number(value) : null;
  }

  /**
   * Elimina el estado del turno actual de Redis.
   *
   * Se debe invocar al finalizar o reiniciar la partida.
   *
   * @param gameId ID de la partida
   */
  async clearTurn(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:turn`);
  }

  /**
   * Marca en Redis quién tiene el timeout activo para validar si pierde el turno.
   *
   * Se guarda como: `game:{gameId}:turn:timeout` = userId
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador que debe actuar dentro del tiempo límite
   */
  async setTurnTimeout(gameId: number, userId: number): Promise<void> {
    await this.redis.set(`game:${gameId}:turn:timeout`, userId.toString());
  }

  /**
   * Obtiene el ID del jugador que tiene un timeout de disparo activo.
   *
   * Se usa para validar si el jugador sigue teniendo el turno
   * cuando se dispara el timeout en memoria.
   *
   * @param gameId ID de la partida
   * @returns userId del jugador o `null` si no hay valor
   */
  async getTurnTimeout(gameId: number): Promise<number | null> {
    const value = await this.redis.get(`game:${gameId}:turn:timeout`);
    return value ? Number(value) : null;
  }

  /**
   * Elimina el timeout activo de turno en Redis.
   *
   * Se invoca al finalizar correctamente un turno.
   *
   * @param gameId ID de la partida
   */
  async clearTurnTimeout(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:turn:timeout`);
  }

  /**
   * Incrementa en 1 el contador de turnos perdidos por inactividad.
   *
   * Se guarda como: `game:{gameId}:missed:{userId}`
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador que perdió el turno
   * @returns Nuevo valor del contador tras incrementarlo
   */
  async incrementMissedTurns(gameId: number, userId: number): Promise<number> {
    const key = `game:${gameId}:missed:${userId}`;
    return this.redis.incr(key);
  }

  /**
   * Reinicia el contador de turnos perdidos para un jugador.
   *
   * Esto puede usarse si el jugador vuelve a actuar correctamente.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador
   */
  async resetMissedTurns(gameId: number, userId: number): Promise<void> {
    const key = `game:${gameId}:missed:${userId}`;
    await this.redis.del(key);
  }
}
