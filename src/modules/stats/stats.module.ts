import { Module } from '@nestjs/common';
import { StatsService } from './application/services/stats.service';
import { GamePlayerStatsPrismaRepository } from './infrastructure/repository/prisma/game-player-stats.prisma.repository';
import { GamePlayerStatsRepository } from './domain/repository/game-player-stats.repository';
import { UserGlobalStatsPrismaRepository } from './infrastructure/repository/prisma/user-global-stats.prisma.repository';
import { UserGlobalStatsRepository } from './domain/repository/user-global-stats.repository';
import { StatsFacade } from './application/facade/stats.facade';
import { PrismaService } from '../../prisma/prisma.service';
import { StatsController } from './infrastructure/http/stats.controller';
import { StatsQueryService } from './application/services/stats-query.service';
import { JwtProviderModule } from '../../shared/jwt/jwt.module';

@Module({
  imports: [JwtProviderModule],
  controllers: [StatsController],
  providers: [
    PrismaService,
    StatsService,
    StatsQueryService,
    StatsFacade,
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
