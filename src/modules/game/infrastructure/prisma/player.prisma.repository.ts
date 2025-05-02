import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { PlayerRepository } from '../../domain/repository/player.repository';

@Injectable()
export class PlayerPrismaRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async markPlayerAsDefeated(gameId: number, userId: number): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, userId: userId },
      data: { leftAt: new Date() },
    });
  }

  async markPlayerAsDefeatedById(id: number): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { id: id },
      data: { leftAt: new Date() },
    });
  }

  async markPlayerAsWinner(playerId: number): Promise<void> {
    await this.prisma.gamePlayer.update({
      where: { id: playerId },
      data: { isWinner: true },
    });
  }

  async markTeamPlayersAsWinners(
    gameId: number,
    team: number | null,
  ): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, team: team },
      data: { isWinner: true },
    });
  }
}
