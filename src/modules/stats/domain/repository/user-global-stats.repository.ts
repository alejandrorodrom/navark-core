import { PlayerStats } from '../models/stats.model';
import { UserGlobalStats } from '../../../../prisma/prisma.types';

/**
 * Contrato para actualizar estadísticas acumuladas del usuario.
 */
export abstract class UserGlobalStatsRepository {
  abstract findByUserId(userId: number): Promise<UserGlobalStats | null>;
  abstract upsertFromGameStats(stat: PlayerStats): Promise<void>;
}
