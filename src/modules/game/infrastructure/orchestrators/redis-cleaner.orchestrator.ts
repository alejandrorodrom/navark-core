import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';

/**
 * Servicio responsable de limpiar los estados almacenados en Redis
 * relacionados con partidas finalizadas o abandonadas.
 *
 * Este servicio coordina la limpieza de:
 * - Estados de turnos
 * - Estados de preparación de jugadores
 * - Asignaciones de equipos
 * - Estados de armas nucleares
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
   * Limpia todos los estados en Redis relacionados con una partida específica.
   * Este método debe llamarse cuando una partida finaliza o es abandonada.
   *
   * Ejecuta las operaciones de limpieza en paralelo para optimizar el rendimiento.
   *
   * @param gameId Identificador de la partida cuyos estados serán eliminados
   * @returns Promise que se resuelve cuando todas las operaciones de limpieza han finalizado
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
