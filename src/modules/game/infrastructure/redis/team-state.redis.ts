import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

/**
 * Servicio encargado de gestionar la asignación de equipos a jugadores en Redis.
 *
 * Se utiliza durante la fase de lobby para definir manualmente los equipos de cada jugador
 * antes del inicio de la partida.
 *
 * Redis almacena los datos como:
 * - Clave: `game:{gameId}:teams`
 * - Campo: userId (número convertido a string)
 * - Valor: número de equipo asignado
 */
@Injectable()
export class TeamStateRedis {
  constructor(private readonly redisService: RedisService) {}

  /** Acceso directo al cliente Redis */
  private get redis() {
    return this.redisService.getClient();
  }

  /**
   * Asigna a un jugador (por userId) a un equipo en una partida.
   *
   * @param gameId ID de la partida
   * @param userId ID numérico del jugador
   * @param team Número de equipo asignado (ej: 1, 2 o 3)
   * @returns Promise<void>
   */
  async setPlayerTeam(
    gameId: number,
    userId: number,
    team: number,
  ): Promise<void> {
    await this.redis.hset(
      `game:${gameId}:teams`,
      userId.toString(),
      team.toString(),
    );
  }

  /**
   * Recupera el número de equipo asignado a un jugador en una partida.
   *
   * @param gameId ID de la partida
   * @param userId ID numérico del jugador
   * @returns Número de equipo o `null` si no tiene asignado
   */
  async getPlayerTeam(gameId: number, userId: number): Promise<number | null> {
    const team = await this.redis.hget(
      `game:${gameId}:teams`,
      userId.toString(),
    );
    return team ? Number(team) : null;
  }

  /**
   * Devuelve todas las asignaciones de equipos de la partida.
   *
   * Retorna un objeto donde cada clave es el userId (como número)
   * y su valor es el número de equipo asignado.
   *
   * @param gameId ID de la partida
   * @returns Mapa con los equipos asignados: `{ userId: teamNumber }`
   */
  async getAllTeams(gameId: number): Promise<Record<number, number>> {
    const raw = await this.redis.hgetall(`game:${gameId}:teams`);
    const result: Record<number, number> = {};

    for (const [userIdStr, teamStr] of Object.entries(raw)) {
      const userId = Number(userIdStr);
      const team = Number(teamStr);
      if (!isNaN(userId) && !isNaN(team)) {
        result[userId] = team;
      }
    }

    return result;
  }

  /**
   * Elimina todas las asignaciones de equipos para una partida.
   *
   * Se recomienda llamar a este método al finalizar o reiniciar una partida.
   *
   * @param gameId ID de la partida
   */
  async clearTeams(gameId: number): Promise<void> {
    await this.redis.del(`game:${gameId}:teams`);
  }
}
