import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { ShotRepository } from '../../domain/repository/shot.repository';
import { Shot } from 'generated/prisma';
import { ShotTarget, ShotType } from '../../domain/models/shot.model';

@Injectable()
export class ShotPrismaRepository implements ShotRepository {
  constructor(private readonly prisma: PrismaService) {}

  registerShot(
    gameId: number,
    shooterId: number,
    type: ShotType,
    target: ShotTarget,
    hit: boolean,
  ): Promise<Shot> {
    return this.prisma.shot.create({
      data: {
        gameId,
        shooterId,
        type,
        target,
        hit: hit,
      },
    });
  }
}
