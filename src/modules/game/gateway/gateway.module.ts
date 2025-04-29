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
import { WebSocketServerService } from './services/web-socket-server.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { RedisStateModule } from './redis/redis-state.module';
import { TurnManagerService } from './services/turn-manager.service';
import { TurnTimeoutService } from './services/turn-timeout.service';
import { BoardGenerationService } from './services/board-generation.service';
import { ShotService } from './services/shot.service';

@Module({
  imports: [RedisStateModule, PrismaModule],
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
    TurnManagerService,
    TurnTimeoutService,
    WebSocketServerService,
    BoardGenerationService,
    ShotService,
  ],
  exports: [GameGateway],
})
export class GatewayModule {}
