import { CreateGameDto } from '../dto/create-game.dto';
import { Game } from '../../../../../generated/prisma';

export abstract class GameRepository {
  abstract createGameWithPlayer(
    dto: CreateGameDto,
    userId: number,
  ): Promise<Game>;
}
