import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameRepository } from '../../domain/repository/game.repository';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { Game } from '../../../../../generated/prisma';

@Injectable()
export class GamePrismaRepository implements GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createGameWithPlayer(
    dto: CreateGameDto,
    userId: number,
  ): Promise<Game> {
    const game = await this.prisma.game.create({
      data: {
        name: dto.name,
        accessCode: dto.accessCode,
        isPublic: dto.isPublic,
        isMatchmaking: false,
        maxPlayers: dto.maxPlayers,
        mode: dto.mode,
        teamCount: dto.mode === 'teams' ? dto.teamCount : null,
        createdById: userId,
        status: 'waiting',
      },
    });

    await this.prisma.gamePlayer.create({
      data: {
        userId,
        gameId: game.id,
        board: {}, // se llenará luego
      },
    });

    return game;
  }
}
