import { Module } from '@nestjs/common';
import { GameController } from './infrastructure/http/game.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGameService } from './application/services/create-game.service';
import { GameFacade } from './application/facade/game.facade';
import { GameRepository } from './domain/repository/game.repository';
import { GamePrismaRepository } from './infrastructure/prisma/game.prisma.repository';
import { MatchmakingService } from './application/services/matchmaking.service';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameService,
    MatchmakingService,
    GameFacade,
    { provide: GameRepository, useClass: GamePrismaRepository },
  ],
})
export class GameModule {}
