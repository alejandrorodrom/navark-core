import { PlayerStats } from '../../domain/models/stats.model';
import { GamePlayerStatsCreateInput } from '../../../../prisma/prisma.types';

/**
 * Transforma un objeto de estadísticas de jugador calculadas (`PlayerStats`)
 * en un input compatible con Prisma (`GamePlayerStatsCreateInput`).
 *
 * @param stat Estadísticas del jugador calculadas en memoria
 * @param gameId ID de la partida asociada
 * @returns Objeto compatible con `prisma.gamePlayerStats.create()`
 */
export function mapPlayerStatsToPrismaInput(
  stat: PlayerStats,
  gameId: number,
): GamePlayerStatsCreateInput {
  return {
    game: { connect: { id: gameId } },
    user: { connect: { id: stat.userId } },
    totalShots: stat.totalShots,
    successfulShots: stat.successfulShots,
    accuracy: stat.accuracy,
    shipsSunk: stat.shipsSunk,
    wasWinner: stat.wasWinner,
    turnsTaken: stat.turnsTaken,
    shipsRemaining: stat.shipsRemaining,
    wasEliminated: stat.wasEliminated,
    hitStreak: stat.hitStreak,
    lastShotWasHit: stat.lastShotWasHit,
    shotsByType: stat.shotsByType,
  };
}
