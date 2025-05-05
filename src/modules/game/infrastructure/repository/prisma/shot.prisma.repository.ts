import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { ShotRepository } from '../../../domain/repository/shot.repository';
import { Shot } from 'prisma-client-f15084464449711e4caee4566fa960144a1bc91a54a7ba08fcf8d12e47ec9ee3';
import { ShotTarget, ShotType } from '../../../domain/models/shot.model';

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
