import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { Board, Ship } from '../../domain/models/board.model';
import { Shot, ShotType } from '../../domain/models/shot.model'; // ✅ Importar Shot y ShotType

/**
 * ShotService se encarga de procesar y registrar disparos dentro del tablero de juego.
 */
@Injectable()
export class ShotService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evalúa si el disparo ha impactado y si un barco fue hundido.
   * @param ships Barcos del tablero.
   * @param targetRow Fila objetivo del disparo.
   * @param targetCol Columna objetivo del disparo.
   * @returns Resultado del disparo.
   */
  handleShot(
    ships: Ship[],
    targetRow: number,
    targetCol: number,
  ): { hit: boolean; sunkShipId?: number } {
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
    target: { row: number; col: number };
    board: Board;
  }): Promise<{
    shot: Shot;
    updatedBoard: Board;
  }> {
    const { gameId, shooterId, type, target, board } = params;

    const result = this.handleShot(board.ships, target.row, target.col);

    const createdShot = await this.prisma.shot.create({
      data: {
        gameId,
        shooterId,
        type,
        target,
        hit: result.hit,
      },
    });

    return {
      shot: {
        id: createdShot.id,
        gameId: createdShot.gameId,
        shooterId: createdShot.shooterId,
        type: createdShot.type as ShotType,
        target: createdShot.target as { row: number; col: number },
        hit: createdShot.hit,
        sunkShipId: result.sunkShipId,
        createdAt: createdShot.createdAt.toISOString(), // ✅
      },
      updatedBoard: board,
    };
  }
}
