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
import { PlayerRepository } from './domain/repository/player.repository';
import { PlayerPrismaRepository } from './infrastructure/prisma/player.prisma.repository';
import { SpectatorRepository } from './domain/repository/spectator.repository';
import { SpectatorPrismaRepository } from './infrastructure/prisma/spectator.prisma.repository';
import { ShotRepository } from './domain/repository/shot.repository';
import { ShotPrismaRepository } from './infrastructure/prisma/shot.prisma.repository';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameService,
    MatchmakingService,
    GameFacade,
    { provide: GameRepository, useClass: GamePrismaRepository },
    { provide: PlayerRepository, useClass: PlayerPrismaRepository },
    { provide: ShotRepository, useClass: ShotPrismaRepository },
    { provide: SpectatorRepository, useClass: SpectatorPrismaRepository },
  ],
  imports: [RedisModule, GatewayModule],
})
export class GameModule {}
