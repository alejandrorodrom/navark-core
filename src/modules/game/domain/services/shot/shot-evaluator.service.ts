import { Ship } from '../../models/ship.model';
import { ShotResult } from '../../models/shot.model';

export class ShotEvaluatorService {
  static evaluate(ships: Ship[], row: number, col: number): ShotResult {
    for (const ship of ships) {
      for (const pos of ship.positions) {
        if (pos.row === row && pos.col === col && !pos.isHit && !ship.isSunk) {
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
}
