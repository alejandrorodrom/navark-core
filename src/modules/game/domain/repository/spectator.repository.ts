import { Spectator } from '../../../../prisma/prisma.types';

export abstract class SpectatorRepository {
  abstract findFirst(
    gameId: number,
    playerId: number,
  ): Promise<Spectator | null>;
}
