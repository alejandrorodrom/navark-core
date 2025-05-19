import { Injectable } from '@nestjs/common';
import { UserGlobalStatsRepository } from '../../../domain/repository/user-global-stats.repository';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { PlayerStats } from '../../../domain/models/stats.model';
import { UserGlobalStats } from '../../../../../prisma/prisma.types';

/**
 * Implementación Prisma del repositorio para actualizar o crear
 * estadísticas acumuladas de un usuario (`UserGlobalStats`).
 */
@Injectable()
export class UserGlobalStatsPrismaRepository
  implements UserGlobalStatsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: number): Promise<UserGlobalStats | null> {
    return this.prisma.userGlobalStats.findUnique({
      where: { userId },
    });
  }

  /**
   * Inserta o actualiza el resumen de estadísticas acumuladas
   * para un usuario, a partir del resultado de una partida.
   *
   * @param stat Estadísticas del jugador en una partida específica
   */
  async upsertFromGameStats(stat: PlayerStats): Promise<void> {
    const current = await this.prisma.userGlobalStats.findUnique({
      where: { userId: stat.userId },
    });

    const totalShots = (current?.totalShots ?? 0) + stat.totalShots;
    const successfulShots =
      (current?.successfulShots ?? 0) + stat.successfulShots;
    const accuracy =
      totalShots > 0 ? +((successfulShots / totalShots) * 100).toFixed(2) : 0;

    await this.prisma.userGlobalStats.upsert({
      where: { userId: stat.userId },
      update: {
        gamesPlayed: { increment: 1 },
        gamesWon: stat.wasWinner ? { increment: 1 } : undefined,
        totalShots: { increment: stat.totalShots },
        successfulShots: { increment: stat.successfulShots },
        shipsSunk: { increment: stat.shipsSunk },
        totalTurnsTaken: { increment: stat.turnsTaken },
        maxHitStreak: {
          set: Math.max(current?.maxHitStreak ?? 0, stat.hitStreak),
        },
        nuclearUsed: { increment: stat.shotsByType.nuclear || 0 },
        lastGameAt: new Date(),
        accuracy,
      },
      create: {
        userId: stat.userId,
        gamesPlayed: 1,
        gamesWon: stat.wasWinner ? 1 : 0,
        totalShots: stat.totalShots,
        successfulShots: stat.successfulShots,
        accuracy,
        shipsSunk: stat.shipsSunk,
        totalTurnsTaken: stat.turnsTaken,
        maxHitStreak: stat.hitStreak,
        nuclearUsed: stat.shotsByType.nuclear || 0,
        lastGameAt: new Date(),
      },
    });
  }
}
