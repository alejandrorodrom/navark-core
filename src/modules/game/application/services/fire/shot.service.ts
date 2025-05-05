import { Injectable } from '@nestjs/common';
import { Board } from '../../../domain/models/board.model';
import { Shot, ShotType, ShotTarget } from '../../../domain/models/shot.model';
import { ShotRepository } from '../../../domain/repository/shot.repository';
import { ShotEvaluatorService } from '../../../domain/services/shot/shot-evaluator.service';

/**
 * ShotService se encarga de orquestar disparos y registrarlos.
 */
@Injectable()
export class ShotService {
  constructor(private readonly shotRepository: ShotRepository) {}

  /**
   * Procesa y registra un disparo en la base de datos.
   * @param params Datos del disparo y tablero.
   * @returns Disparo registrado y tablero actualizado.
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

    const result = ShotEvaluatorService.evaluate(
      board.ships,
      target.row,
      target.col,
    );

    const createdShot = await this.shotRepository.registerShot(
      gameId,
      shooterId,
      type,
      target,
      result.hit,
    );

    const shot: Shot = {
      id: createdShot.id,
      gameId: createdShot.gameId,
      shooterId: createdShot.shooterId,
      type: createdShot.type as ShotType,
      target: createdShot.target as { row: number; col: number },
      hit: createdShot.hit,
      sunkShipId: result.sunkShipId,
      createdAt: createdShot.createdAt.toISOString(),
    };

    if (!board.shots) {
      board.shots = [];
    }
    board.shots.push(shot);

    return {
      shot,
      updatedBoard: board,
    };
  }
}
