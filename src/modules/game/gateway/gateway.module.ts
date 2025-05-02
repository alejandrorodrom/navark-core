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
import { BoardHandler } from './handlers/board.handler';
import { ReconnectHandler } from './handlers/reconnect.handler';
import { GameRepository } from '../domain/repository/game.repository';
import { GamePrismaRepository } from '../infrastructure/prisma/game.prisma.repository';
import { GameStatsService } from './services/game-stats.service';
import { PlayerRepository } from '../domain/repository/player.repository';
import { PlayerPrismaRepository } from '../infrastructure/prisma/player.prisma.repository';
import { SpectatorRepository } from '../domain/repository/spectator.repository';
import { SpectatorPrismaRepository } from '../infrastructure/prisma/spectator.prisma.repository';
import { ShotRepository } from '../domain/repository/shot.repository';
import { ShotPrismaRepository } from '../infrastructure/prisma/shot.prisma.repository';

@Module({
  imports: [RedisStateModule, PrismaModule],
  providers: [
    GameGateway,
    ConnectionHandler,
    ReconnectHandler,
    CreatorHandler,
    FireHandler,
    JoinHandler,
    LeaveHandler,
    StartGameHandler,
    BoardHandler,
    GameUtils,
    RedisUtils,
    TurnManagerService,
    TurnTimeoutService,
    WebSocketServerService,
    BoardGenerationService,
    ShotService,
    GameStatsService,
    { provide: GameRepository, useClass: GamePrismaRepository },
    { provide: PlayerRepository, useClass: PlayerPrismaRepository },
    { provide: ShotRepository, useClass: ShotPrismaRepository },
    { provide: SpectatorRepository, useClass: SpectatorPrismaRepository },
  ],
  exports: [GameGateway],
})
export class GatewayModule {}
