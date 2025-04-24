import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { GameModule } from './modules/game/game.module';

@Module({
  imports: [AuthModule, GameModule],
})
export class AppModule {}
