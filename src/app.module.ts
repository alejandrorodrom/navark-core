import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { GameModule } from './modules/game/game.module';
import { StatsModule } from './modules/stats/stats.module';

@Module({
  imports: [AuthModule, GameModule, StatsModule],
})
export class AppModule {}
