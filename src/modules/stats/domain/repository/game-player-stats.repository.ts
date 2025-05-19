import { PlayerStats } from '../models/stats.model';
import { GamePlayerStatsWithUser } from '../../../../prisma/prisma.types';

/**
 * Contrato para guardar estadísticas de jugadores en una partida.
 */
export abstract class GamePlayerStatsRepository {
  abstract findByGameId(gameId: number): Promise<GamePlayerStatsWithUser[]>;
  abstract saveMany(gameId: number, stats: PlayerStats[]): Promise<void>;
}
