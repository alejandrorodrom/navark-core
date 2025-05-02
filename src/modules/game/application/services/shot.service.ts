import { Injectable } from '@nestjs/common';
import { Board } from '../../domain/models/board.model';
import {
  Shot,
  ShotResult,
  ShotTarget,
  ShotType,
} from '../../domain/models/shot.model';
import { ShotRepository } from '../../domain/repository/shot.repository';
import { Ship } from '../../domain/models/ship.model';

/**
 * ShotService se encarga de procesar y registrar disparos dentro del tablero de juego.
 */
@Injectable()
export class ShotService {
  constructor(private readonly shotRepository: ShotRepository) {}

  /**
   * Evalúa si el disparo ha impactado y si un barco fue hundido.
   * @param ships Barcos del tablero.
   * @param targetRow Fila objetivo del disparo.
   * @param targetCol Columna objetivo del disparo.
   * @returns Resultado del disparo.
   */
  handleShot(ships: Ship[], targetRow: number, targetCol: number): ShotResult {
    for (const ship of ships) {
      for (const pos of ship.positions) {
        if (
          pos.row === targetRow &&
          pos.col === targetCol &&
          !pos.isHit &&
          !ship.isSunk
        ) {
          pos.isHit = true;

          if (ship.positions.every((p) => p.isHit)) {
            ship.isSunk = true;
            return { hit: true, sunkShipId: ship.shipId };
          }

          return { hit: true };
        }
      }
    }

    return { hit: false };
  }

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

    const result = this.handleShot(board.ships, target.row, target.col);

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
