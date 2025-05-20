import { Injectable } from '@nestjs/common';
import { CreateGameUseCase } from '../use-cases/create-game.use-case';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { MatchmakingUseCase } from '../use-cases/matchmaking.use-case';

@Injectable()
export class GameFacade {
  constructor(
    private readonly createGameService: CreateGameUseCase,
    private readonly matchmakingService: MatchmakingUseCase,
  ) {}

  async createManualGame(dto: CreateGameDto, userId: number) {
    return this.createGameService.execute(dto, userId);
  }

  async enterMatchmaking(dto: MatchmakingDto, userId: number) {
    return this.matchmakingService.execute(dto, userId);
  }
}
