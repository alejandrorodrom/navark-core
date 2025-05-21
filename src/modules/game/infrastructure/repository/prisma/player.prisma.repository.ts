import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { PlayerRepository } from '../../../domain/repository/player.repository';

/**
 * Implementación del repositorio de jugadores utilizando Prisma.
 *
 * Permite actualizar el estado de los jugadores dentro de una partida:
 * - Marcar como eliminados (defeated)
 * - Marcar como ganadores (individual o en equipo)
 */
@Injectable()
export class PlayerPrismaRepository implements PlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Marca a un jugador como eliminado (derrotado) usando su `userId` y `gameId`.
   * Esto se refleja en la base de datos estableciendo `leftAt` con la hora actual.
   *
   * @param gameId ID de la partida
   * @param userId ID del usuario eliminado
   */
  async markPlayerAsDefeated(gameId: number, userId: number): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, userId },
      data: { leftAt: new Date() },
    });
  }

  /**
   * Marca a un jugador como eliminado (derrotado) utilizando el `id` de GamePlayer.
   *
   * @param playerId ID del registro GamePlayer
   */
  async markPlayerAsDefeatedById(playerId: number): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { id: playerId },
      data: { leftAt: new Date() },
    });
  }

  /**
   * Marca a un jugador como ganador de la partida, utilizando su `GamePlayer.id`.
   * Se actualiza el campo `isWinner` a `true`.
   *
   * @param playerId ID del registro GamePlayer
   */
  async markPlayerAsWinner(playerId: number): Promise<void> {
    await this.prisma.gamePlayer.update({
      where: { id: playerId },
      data: { isWinner: true },
    });
  }

  /**
   * Marca a todos los jugadores de un equipo como ganadores en una partida.
   * Se aplica a todos los registros que coincidan con `gameId` y `team`.
   *
   * @param gameId ID de la partida
   * @param team Número del equipo ganador (puede ser null si aplica)
   */
  async markTeamPlayersAsWinners(
    gameId: number,
    team: number | null,
  ): Promise<void> {
    await this.prisma.gamePlayer.updateMany({
      where: { gameId, team },
      data: { isWinner: true },
    });
  }
}
