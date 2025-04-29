import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameRepository } from '../../domain/repository/game.repository';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { Game } from '../../../../prisma/prisma.types';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { GameStatus } from '../../../../prisma/prisma.enum';

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
        difficulty: dto.difficulty,
        teamCount: dto.mode === 'teams' ? dto.teamCount : null,
        createdById: userId,
        status: GameStatus.waiting,
      },
    });

    await this.prisma.gamePlayer.create({
      data: {
        userId,
        gameId: game.id,
        team: null,
      },
    });

    return game;
  }

  async findOrCreateMatch(dto: MatchmakingDto, userId: number): Promise<Game> {
    const found = await this.prisma.game.findFirst({
      where: {
        isMatchmaking: true,
        status: GameStatus.waiting,
        mode: dto.mode ?? undefined,
        maxPlayers: dto.maxPlayers ?? undefined,
        difficulty: dto.difficulty ?? undefined,
      },
      include: { gamePlayers: true },
    });

    if (found && found.gamePlayers.length < found.maxPlayers) {
      await this.prisma.gamePlayer.create({
        data: {
          userId,
          gameId: found.id,
          team: null,
        },
      });
      return found;
    }

    const newGame = await this.prisma.game.create({
      data: {
        isPublic: false,
        isMatchmaking: true,
        maxPlayers: dto.maxPlayers ?? 2,
        mode: dto.mode ?? 'individual',
        difficulty: dto.difficulty ?? 'medium',
        teamCount: dto.mode === 'teams' ? 2 : null,
        createdById: userId,
        status: GameStatus.waiting,
      },
    });

    await this.prisma.gamePlayer.create({
      data: {
        userId,
        gameId: newGame.id,
        team: null,
      },
    });

    return newGame;
  }
}
