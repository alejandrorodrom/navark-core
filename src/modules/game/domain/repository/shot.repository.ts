import { Shot } from '../../../../prisma/prisma.types';
import { ShotTarget, ShotType } from '../models/shot.model';

export abstract class ShotRepository {
  abstract registerShot(
    gameId: number,
    shooterId: number,
    type: ShotType,
    target: ShotTarget,
    hit: boolean,
  ): Promise<Shot>;
}
