import { Injectable } from '@nestjs/common';
import { CreateGameService } from '../services/create-game.service';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { MatchmakingService } from '../services/matchmaking.service';

@Injectable()
export class GameFacade {
  constructor(
    private readonly createGameService: CreateGameService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  async createManualGame(dto: CreateGameDto, userId: number) {
    return this.createGameService.execute(dto, userId);
  }

  async enterMatchmaking(dto: MatchmakingDto, userId: number) {
    return this.matchmakingService.execute(dto, userId);
  }
}
