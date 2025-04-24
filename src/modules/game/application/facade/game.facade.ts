import { Injectable } from '@nestjs/common';
import { CreateGameService } from '../services/create-game.service';
import { CreateGameDto } from '../../domain/dto/create-game.dto';

@Injectable()
export class GameFacade {
  constructor(private readonly createGameService: CreateGameService) {}

  async createManualGame(dto: CreateGameDto, userId: number) {
    return this.createGameService.execute(dto, userId);
  }
}
