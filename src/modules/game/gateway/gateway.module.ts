import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { ConnectionHandler } from './handlers/connection.handler';
import { CreatorHandler } from './handlers/creator.handler';
import { FireHandler } from './handlers/fire.handler';
import { JoinHandler } from './handlers/join.handler';
import { LeaveHandler } from './handlers/leave.handler';
import { StartGameHandler } from './handlers/start-game.handler';
import { GameUtils } from './utils/game.utils';
import { RedisUtils } from './utils/redis.utils';
import { RedisModule } from '../../../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    GameGateway,
    ConnectionHandler,
    CreatorHandler,
    FireHandler,
    JoinHandler,
    LeaveHandler,
    StartGameHandler,
    GameUtils,
    RedisUtils,
  ],
  exports: [GameGateway],
})
export class GatewayModule {}
