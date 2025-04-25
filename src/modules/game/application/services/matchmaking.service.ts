import { Injectable } from '@nestjs/common';
import { GameRepository } from '../../domain/repository/game.repository';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { GameResponseDto } from '../../domain/dto/game-response.dto';
import { GameMapper } from '../../infrastructure/mappers/game.mapper';

@Injectable()
export class MatchmakingService {
  constructor(private readonly gameRepo: GameRepository) {}

  async execute(dto: MatchmakingDto, userId: number): Promise<GameResponseDto> {
    const game = await this.gameRepo.findOrCreateMatch(dto, userId);
    return GameMapper.toResponse(game);
  }
}
