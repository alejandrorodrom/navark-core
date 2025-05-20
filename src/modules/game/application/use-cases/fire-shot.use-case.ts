import { Injectable, Logger } from '@nestjs/common';
import { Board } from '../../domain/models/board.model';
import { Shot, ShotType, ShotTarget } from '../../domain/models/shot.model';
import { ShotRepository } from '../../domain/repository/shot.repository';
import { TeamStateRedis } from '../../infrastructure/redis/team-state.redis';
import { ShotEvaluatorLogic } from '../../domain/logic/shot-evaluator.logic';

/**
 * Servicio de aplicación que orquesta la lógica de disparos:
 * - Genera coordenadas según el tipo de disparo
 * - Filtra objetivos inválidos (ya disparados o aliados)
 * - Evalúa impactos y hundimientos
 * - Registra el disparo principal en base de datos
 * - Actualiza el tablero con disparos visuales
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
   * Orquesta el disparo de un jugador en una partida.
   *
   * @param params Parámetros del disparo incluyendo jugador, tipo, objetivo y tablero actual
   * @returns Disparo principal registrado y tablero con disparos actualizados
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

    // Obtiene los equipos desde Redis y los convierte a un formato usable
    const teamsRaw = await this.teamStateRedis.getAllTeams(gameId);
    const teams = this.shotEvaluator.convertTeamsFormat(teamsRaw);

    // Genera las coordenadas afectadas según el tipo de disparo
    const targets = this.shotEvaluator.generateTargetsForShotType(
      type,
      target,
      board.size,
    );

    this.logger.debug(
      `Generadas ${targets.length} coordenadas para disparo tipo ${type}`,
    );

    // El disparo principal que será registrado en base de datos
    let primaryShot: Shot | null = null;

    // Lista de objetivos válidos después de filtrar repetidos y aliados
    const validTargets: ShotTarget[] = [];

    // Filtra los objetivos que ya han sido disparados o que contienen barcos aliados
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

    // Si no se encontraron objetivos válidos, usar solo el objetivo original
    if (validTargets.length === 0) {
      this.logger.warn(
        `No hay objetivos válidos para el disparo tipo ${type}, se usará solo el objetivo principal.`,
      );
      validTargets.push(target);
    }

    // Procesa cada coordenada válida e impacta el tablero
    for (const currentTarget of validTargets) {
      const result = ShotEvaluatorLogic.evaluate(
        board.ships,
        currentTarget.row,
        currentTarget.col,
      );

      // Solo se registra en la base de datos el disparo principal
      const isMainShot =
        currentTarget.row === target.row && currentTarget.col === target.col;

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

      // Si el tablero aún no tiene array de disparos, se inicializa
      if (!board.shots) {
        board.shots = [];
      }

      // Se agrega cada disparo al tablero como referencia visual
      const shotToAdd: Shot =
        isMainShot && primaryShot
          ? { ...primaryShot }
          : {
              id: -1, // Identificador temporal para disparos secundarios
              gameId,
              shooterId,
              type,
              target: currentTarget,
              hit: result.hit,
              sunkShipId: result.sunkShipId,
              createdAt: new Date().toISOString(),
            };

      // Asegura que los datos reflejen esta coordenada
      shotToAdd.target = currentTarget;
      shotToAdd.hit = result.hit;
      shotToAdd.sunkShipId = result.sunkShipId;

      board.shots.push(shotToAdd);
    }

    // Si no se logró registrar el disparo principal, se considera un error
    if (!primaryShot) {
      this.logger.error('No se pudo registrar el disparo principal');
      throw new Error('Error al registrar el disparo principal');
    }

    // Retorna el disparo registrado y el tablero actualizado
    return {
      shot: primaryShot,
      updatedBoard: board,
    };
  }
}
