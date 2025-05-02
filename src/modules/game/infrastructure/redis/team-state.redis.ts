import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * TeamStateRedis gestiona en Redis la asignación de equipos a los jugadores durante la fase de lobby.
 */
@Injectable()
export class TeamStateRedis {
  constructor(private readonly redisService: RedisService) {}

  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Asigna un equipo a un jugador dentro de una partida.
   * @param gameId ID de la partida.
   * @param socketId ID del socket del jugador.
   * @param team Número de equipo asignado.
   */
  async setPlayerTeam(
    gameId: number,
    socketId: string,
    team: number,
  ): Promise<void> {
    await this.redis.hset(`game:${gameId}:teams`, socketId, team.toString());
  }

  /**
   * Obtiene el número de equipo asignado a un jugador en una partida.
   * @param gameId ID de la partida.
   * @param socketId ID del socket del jugador.
   * @returns Número de equipo o `null` si no está asignado.
   */
  async getPlayerTeam(
    gameId: number,
    socketId: string,
  ): Promise<number | null> {
    const team = await this.redis.hget(`game:${gameId}:teams`, socketId);
    return team ? Number(team) : null;
  }

  /**
   * Obtiene todos los equipos asignados en una partida.
   * @param gameId ID de la partida.
   * @returns Objeto donde la clave es el socketId y el valor es el número de equipo.
   */
  async getAllTeams(gameId: number): Promise<Record<string, number>> {
    const raw = await this.redis.hgetall(`game:${gameId}:teams`);
    const result: Record<string, number> = {};
    for (const [socketId, team] of Object.entries(raw)) {
      result[socketId] = Number(team);
    }
    return result;
  }

  /**
   * Limpia todos los equipos asignados en una partida.
   * @param gameId ID de la partida.
   */
  async clearTeams(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:teams`);
  }
}
