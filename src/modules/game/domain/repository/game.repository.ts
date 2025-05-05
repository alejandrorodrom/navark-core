import { CreateGameDto } from '../dto/create-game.dto';
import {
  Game,
  GameWithPlayers,
  GameWithPlayersAndSpectator,
  GameWithPlayersAndUsers,
} from '../../../../prisma/prisma.types';
import { MatchmakingDto } from '../dto/matchmaking.dto';
import { Board } from '../models/board.model';

export abstract class GameRepository {
  abstract createGameWithPlayer(
    dto: CreateGameDto,
    userId: number,
  ): Promise<Game>;

  abstract findOrCreateMatch(
    dto: MatchmakingDto,
    userId: number,
  ): Promise<Game>;

  abstract findByIdWithPlayers(id: number): Promise<GameWithPlayers | null>;

  abstract findByIdWithPlayersAndUsers(
    id: number,
  ): Promise<GameWithPlayersAndUsers | null>;

  abstract findByIdWithPlayersAndSpectator(
    id: number,
  ): Promise<GameWithPlayersAndSpectator | null>;

  abstract findById(id: number): Promise<Game | null>;

  abstract updateGameStartBoard(gameId: number, board: Board): Promise<Game>;

  abstract updateGameCreator(gameId: number, userId: number): Promise<Game>;

  abstract updateGameBoard(gameId: number, board: Board): Promise<Game>;

  abstract markGameAsFinished(gameId: number): Promise<Game>;

  abstract removeAbandonedGames(id: number): Promise<Game>;
}
