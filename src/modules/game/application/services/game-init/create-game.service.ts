import { BadRequestException, Injectable } from '@nestjs/common';
import { GameRepository } from '../../../domain/repository/game.repository';
import { CreateGameDto } from '../../../domain/dto/create-game.dto';
import { GameResponseDto } from '../../../domain/dto/game-response.dto';
import { GameMapper } from '../../mapper/game.mapper';

@Injectable()
export class CreateGameService {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(dto: CreateGameDto, userId: number): Promise<GameResponseDto> {
    if (
      dto.mode === 'teams' &&
      (!dto.teamCount || dto.teamCount < 2 || dto.teamCount > 3)
    ) {
      throw new BadRequestException(
        'El modo por equipos requiere una cantidad válida de equipos (2 a 3).',
      );
    }

    const game = await this.gameRepository.createGameWithPlayer(dto, userId);
    return GameMapper.toResponse(game);
  }
}
