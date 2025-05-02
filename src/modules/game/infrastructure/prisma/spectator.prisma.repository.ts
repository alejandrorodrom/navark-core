import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SpectatorRepository } from '../../domain/repository/spectator.repository';
import { Spectator } from '../../../../prisma/prisma.types';

@Injectable()
export class SpectatorPrismaRepository implements SpectatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findFirst(gameId: number, playerId: number): Promise<Spectator | null> {
    return this.prisma.spectator.findFirst({
      where: { gameId, userId: playerId },
    });
  }
}
