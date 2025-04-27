import { Module } from '@nestjs/common';
import { GameController } from './infrastructure/http/game.controller';
import { CreateGameService } from './application/services/create-game.service';
import { MatchmakingService } from './application/services/matchmaking.service';
import { GameFacade } from './application/facade/game.facade';
import { GameRepository } from './domain/repository/game.repository';
import { GamePrismaRepository } from './infrastructure/prisma/game.prisma.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from '../../redis/redis.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameService,
    MatchmakingService,
    GameFacade,
    { provide: GameRepository, useClass: GamePrismaRepository },
  ],
  imports: [RedisModule, GatewayModule],
})
export class GameModule {}
