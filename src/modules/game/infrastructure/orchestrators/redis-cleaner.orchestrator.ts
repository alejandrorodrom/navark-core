import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';

/**
 * Servicio orquestador responsable de limpiar los estados en Redis
 * asociados a una partida finalizada o abandonada.
 *
 * Se encarga de delegar la limpieza en los submódulos Redis correspondientes:
 * - Turnos
 * - Estado de "listo" por jugador
 * - Asignación de equipos
 * - Progreso de armamento nuclear
 */
@Injectable()
export class RedisCleanerOrchestrator {
  private readonly logger = new Logger(RedisCleanerOrchestrator.name);

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamsStateRedis: TeamStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
  ) {}

  /**
   * Elimina todos los datos temporales de Redis asociados a una partida específica.
   *
   * Este método debe invocarse al terminar o abandonar una partida,
   * para evitar dejar estados huérfanos en memoria.
   *
   * Se ejecutan todas las limpiezas en paralelo con `Promise.all`.
   *
   * @param gameId ID único de la partida a limpiar
   * @returns Promise<void>
   */
  async clearGameRedisState(gameId: number): Promise<void> {
    this.logger.log(
      `Iniciando limpieza de estados Redis para partida ${gameId}`,
    );

    try {
      await Promise.all([
        this.turnStateRedis.clearTurn(gameId),
        this.readyStateRedis.clearReady(gameId),
        this.teamsStateRedis.clearTeams(gameId),
        this.nuclearStateRedis.clearNuclear(gameId),
      ]);

      this.logger.log(
        `Limpieza de estado Redis completada exitosamente para partida ${gameId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al limpiar estados Redis para partida ${gameId}`,
        error,
      );
      throw error;
    }
  }
}
