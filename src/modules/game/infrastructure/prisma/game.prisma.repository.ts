import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameRepository } from '../../domain/repository/game.repository';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { Game } from '../../../../../generated/prisma';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';

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

  async findOrCreateMatch(dto: MatchmakingDto, userId: number): Promise<Game> {
    const found = await this.prisma.game.findFirst({
      where: {
        isMatchmaking: true,
        status: 'waiting',
        mode: dto.mode ?? undefined,
        maxPlayers: dto.maxPlayers ?? undefined,
      },
      include: { gamePlayers: true },
    });

    if (found && found.gamePlayers.length < found.maxPlayers) {
      await this.prisma.gamePlayer.create({
        data: { userId, gameId: found.id, board: {} },
      });
      return found;
    }

    const newGame = await this.prisma.game.create({
      data: {
        isPublic: false,
        isMatchmaking: true,
        maxPlayers: dto.maxPlayers ?? 2,
        mode: dto.mode ?? 'individual',
        teamCount: dto.mode === 'teams' ? 2 : null,
        createdById: userId,
        status: 'waiting',
      },
    });

    await this.prisma.gamePlayer.create({
      data: { userId, gameId: newGame.id, board: {} },
    });

    return newGame;
  }
}
