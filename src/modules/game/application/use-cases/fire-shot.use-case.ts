import { Injectable, Logger } from '@nestjs/common';
import { Board } from '../../domain/models/board.model';
import { Shot, ShotType, ShotTarget } from '../../domain/models/shot.model';
import { ShotRepository } from '../../domain/repository/shot.repository';
import { TeamStateRedis } from '../../infrastructure/redis/team-state.redis';
import { ShotEvaluatorLogic } from '../../domain/logic/shot-evaluator.logic';

/**
 * Caso de uso que orquesta la ejecución de un disparo durante la partida.
 *
 * Este servicio gestiona:
 * - Validación de objetivos (ya disparados o aliados)
 * - Generación de coordenadas afectadas por el tipo de disparo
 * - Evaluación de impactos y hundimientos
 * - Registro del disparo principal en la base de datos
 * - Actualización del tablero en memoria
 */
@Injectable()
export class FireShotUseCase {
  private readonly logger = new Logger(FireShotUseCase.name);

  constructor(
    private readonly shotRepository: ShotRepository,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly shotEvaluator: ShotEvaluatorLogic,
  ) {}

  /**
   * Registra un disparo ejecutado por un jugador.
   *
   * Genera los objetivos afectados por el tipo de disparo, filtra los inválidos,
   * evalúa impactos, registra el disparo principal y actualiza el tablero.
   *
   * @param params Información del disparo: ID de juego, jugador, tipo, objetivo inicial y tablero actual.
   * @returns Objeto con el disparo principal registrado y el tablero actualizado con todos los impactos.
   *
   * @throws Error si no se logra registrar el disparo principal.
   */
  async registerShot(params: {
    gameId: number;
    shooterId: number;
    type: ShotType;
    target: ShotTarget;
    board: Board;
  }): Promise<{
    shot: Shot;
    updatedBoard: Board;
  }> {
    const { gameId, shooterId, type, target, board } = params;

    // 1. Obtener el mapa de equipos desde Redis (formato userId → teamId)
    const teams = await this.teamStateRedis.getAllTeams(gameId);

    // 2. Generar coordenadas afectadas según el tipo de disparo
    const targets = this.shotEvaluator.generateTargetsForShotType(
      type,
      target,
      board.size,
    );

    this.logger.debug(
      `Generadas ${targets.length} coordenadas para disparo tipo ${type}`,
    );

    // 3. Inicializar estructuras de control
    let primaryShot: Shot | null = null;
    const validTargets: ShotTarget[] = [];

    // 4. Filtrar coordenadas ya disparadas o que impactan barcos aliados
    for (const currentTarget of targets) {
      const alreadyShot = board.shots?.some(
        (shot) =>
          shot.target.row === currentTarget.row &&
          shot.target.col === currentTarget.col,
      );

      if (alreadyShot) {
        this.logger.debug(
          `Objetivo (${currentTarget.row},${currentTarget.col}) ya disparado, se omite.`,
        );
        continue;
      }

      const isAlliedShip = this.shotEvaluator.isAlliedShipPosition(
        board.ships,
        currentTarget.row,
        currentTarget.col,
        shooterId,
        teams,
      );

      if (isAlliedShip) {
        this.logger.debug(
          `Objetivo (${currentTarget.row},${currentTarget.col}) contiene barco aliado, se omite.`,
        );
        continue;
      }

      validTargets.push(currentTarget);
    }

    // 5. Si no hay objetivos válidos, usar solo el original
    if (validTargets.length === 0) {
      this.logger.warn(
        `No hay objetivos válidos para el disparo tipo ${type}, se usará solo el objetivo principal.`,
      );
      validTargets.push(target);
    }

    // 6. Procesar impactos en cada coordenada válida
    for (const currentTarget of validTargets) {
      const result = ShotEvaluatorLogic.evaluate(
        board.ships,
        currentTarget.row,
        currentTarget.col,
      );

      const isMainShot =
        currentTarget.row === target.row && currentTarget.col === target.col;

      // 7. Registrar el disparo principal en base de datos
      if (isMainShot) {
        const createdShot = await this.shotRepository.registerShot(
          gameId,
          shooterId,
          type,
          currentTarget,
          result.hit,
        );

        primaryShot = {
          id: createdShot.id,
          gameId: createdShot.gameId,
          shooterId: createdShot.shooterId,
          type: createdShot.type as ShotType,
          target: createdShot.target as ShotTarget,
          hit: createdShot.hit,
          sunkShipId: result.sunkShipId,
          createdAt: createdShot.createdAt.toISOString(),
        };
      }

      // 8. Inicializar estructura de disparos si aún no existe
      if (!board.shots) {
        board.shots = [];
      }

      // 9. Construir el disparo visual y añadirlo al tablero
      const shotToAdd: Shot =
        isMainShot && primaryShot
          ? { ...primaryShot }
          : {
              id: -1, // Temporal para disparos secundarios
              gameId,
              shooterId,
              type,
              target: currentTarget,
              hit: result.hit,
              sunkShipId: result.sunkShipId,
              createdAt: new Date().toISOString(),
            };

      board.shots.push(shotToAdd);
    }

    // 10. Validar que el disparo principal se haya registrado correctamente
    if (!primaryShot) {
      this.logger.error('No se pudo registrar el disparo principal');
      throw new Error('Error al registrar el disparo principal');
    }

    // 11. Devolver el disparo principal y el tablero actualizado
    return {
      shot: primaryShot,
      updatedBoard: board,
    };
  }
}
