import { Injectable } from '@nestjs/common';
import { GamePlayerStatsRepository } from '../../../domain/repository/game-player-stats.repository';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { PlayerStats } from '../../../domain/models/stats.model';
import { mapPlayerStatsToPrismaInput } from '../../../application/mapper/player-stats.mapper';
import {
  GamePlayerStatsWithGame,
  GamePlayerStatsWithUser,
} from '../../../../../prisma/prisma.types';

/**
 * Implementación Prisma del repositorio para persistencia
 * de estadísticas individuales por jugador en una partida.
 */
@Injectable()
export class GamePlayerStatsPrismaRepository
  implements GamePlayerStatsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByGameId(gameId: number): Promise<GamePlayerStatsWithUser[]> {
    return this.prisma.gamePlayerStats.findMany({
      where: { gameId },
      include: { user: { select: { nickname: true } } },
    });
  }

  async findByUserIdWithGame(
    userId: number,
  ): Promise<GamePlayerStatsWithGame[]> {
    return this.prisma.gamePlayerStats.findMany({
      where: { userId },
      include: {
        game: {
          select: {
            id: true,
            mode: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Guarda múltiples estadísticas asociadas a una partida.
   *
   * Cada estadística representa el desempeño individual de un jugador
   * en una partida específica. Este método transforma los datos de
   * dominio a un formato compatible con Prisma.
   *
   * @param gameId ID de la partida asociada
   * @param stats Arreglo de estadísticas por jugador
   */
  async saveMany(gameId: number, stats: PlayerStats[]): Promise<void> {
    for (const stat of stats) {
      const data = mapPlayerStatsToPrismaInput(stat, gameId);
      await this.prisma.gamePlayerStats.create({ data });
    }
  }
}
