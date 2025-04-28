import { Game } from '../../../../prisma/prisma.types';
import { GameResponseDto } from '../../domain/dto/game-response.dto';

export class GameMapper {
  static toResponse(game: Game): GameResponseDto {
    return {
      id: game.id,
      name: game.name ?? undefined,
      accessCode: game.accessCode ?? undefined,
      isPublic: game.isPublic,
      isMatchmaking: game.isMatchmaking,
      maxPlayers: game.maxPlayers,
      mode: game.mode as 'individual' | 'teams',
      teamCount: game.teamCount ?? undefined,
      status: game.status,
      createdAt: game.createdAt,
    };
  }
}
