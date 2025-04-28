import { CreateGameDto } from '../dto/create-game.dto';
import { Game } from '../../../../prisma/prisma.types';
import { MatchmakingDto } from '../dto/matchmaking.dto';

export abstract class GameRepository {
  abstract createGameWithPlayer(
    dto: CreateGameDto,
    userId: number,
  ): Promise<Game>;

  abstract findOrCreateMatch(
    dto: MatchmakingDto,
    userId: number,
  ): Promise<Game>;
}
