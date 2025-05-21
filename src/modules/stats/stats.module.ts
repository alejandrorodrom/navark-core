import { Module } from '@nestjs/common';
import { GeneratePlayerStatsUseCase } from './application/use-cases/generate-player-stats.use-case';
import { GamePlayerStatsPrismaRepository } from './infrastructure/repository/prisma/game-player-stats.prisma.repository';
import { GamePlayerStatsRepository } from './domain/repository/game-player-stats.repository';
import { UserGlobalStatsPrismaRepository } from './infrastructure/repository/prisma/user-global-stats.prisma.repository';
import { UserGlobalStatsRepository } from './domain/repository/user-global-stats.repository';
import { StatsFacade } from './application/facade/stats.facade';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsController } from './infrastructure/http/stats.controller';
import { GetUserStatsUseCase } from './application/use-cases/get-user-stats.use-case';
import { JwtProviderModule } from '../../shared/jwt/jwt.module';
import { StatsCalculatorLogic } from './domain/logic/stats-calculator.logic';

@Module({
  imports: [JwtProviderModule],
  controllers: [StatsController],
  providers: [
    PrismaService,
    GeneratePlayerStatsUseCase,
    GetUserStatsUseCase,
    StatsFacade,
    StatsCalculatorLogic,
    {
      provide: GamePlayerStatsRepository,
      useClass: GamePlayerStatsPrismaRepository,
    },
    {
      provide: UserGlobalStatsRepository,
      useClass: UserGlobalStatsPrismaRepository,
    },
  ],
  exports: [StatsFacade],
})
export class StatsModule {}
