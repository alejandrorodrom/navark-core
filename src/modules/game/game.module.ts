import { Module } from '@nestjs/common';
import { GameController } from './infrastructure/http/game.controller';
import { CreateGameService } from './application/services/create-game.service';
import { MatchmakingService } from './application/services/matchmaking.service';
import { GameFacade } from './application/facade/game.facade';
import { GameRepository } from './domain/repository/game.repository';
import { GamePrismaRepository } from './infrastructure/prisma/game.prisma.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from '../../redis/redis.module';
import { PlayerRepository } from './domain/repository/player.repository';
import { PlayerPrismaRepository } from './infrastructure/prisma/player.prisma.repository';
import { SpectatorRepository } from './domain/repository/spectator.repository';
import { SpectatorPrismaRepository } from './infrastructure/prisma/spectator.prisma.repository';
import { ShotRepository } from './domain/repository/shot.repository';
import { ShotPrismaRepository } from './infrastructure/prisma/shot.prisma.repository';
import { GameGateway } from './infrastructure/websocket/game.gateway';
import { ConnectionHandler } from './infrastructure/websocket/handlers/connection.handler';
import { ReconnectHandler } from './infrastructure/websocket/handlers/reconnect.handler';
import { CreatorHandler } from './infrastructure/websocket/handlers/creator.handler';
import { FireHandler } from './infrastructure/websocket/handlers/fire.handler';
import { JoinHandler } from './infrastructure/websocket/handlers/join.handler';
import { LeaveHandler } from './infrastructure/websocket/handlers/leave.handler';
import { StartGameHandler } from './infrastructure/websocket/handlers/start-game.handler';
import { BoardHandler } from './infrastructure/websocket/handlers/board.handler';
import { RoomManagerService } from './infrastructure/services/game/room-manager.service';
import { StateCleanerService } from './infrastructure/services/game/state-cleaner.service';
import { TurnManagerService } from './infrastructure/services/game/turn-manager.service';
import { TurnTimeoutService } from './infrastructure/services/game/turn-timeout.service';
import { SocketServerAdapter } from './infrastructure/adapters/socket-server.adapter';
import { BoardGenerationService } from './application/services/board-generation.service';
import { ShotService } from './application/services/shot.service';
import { GameStatsService } from './application/services/game-stats.service';
import { RedisStateModule } from './infrastructure/redis/redis-state.module';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameService,
    MatchmakingService,
    GameFacade,

    GameGateway,

    ConnectionHandler,
    ReconnectHandler,
    CreatorHandler,
    FireHandler,
    JoinHandler,
    LeaveHandler,
    StartGameHandler,
    BoardHandler,

    RoomManagerService,
    StateCleanerService,

    TurnManagerService,
    TurnTimeoutService,

    SocketServerAdapter,
    BoardGenerationService,
    ShotService,
    GameStatsService,

    { provide: GameRepository, useClass: GamePrismaRepository },
    { provide: PlayerRepository, useClass: PlayerPrismaRepository },
    { provide: ShotRepository, useClass: ShotPrismaRepository },
    { provide: SpectatorRepository, useClass: SpectatorPrismaRepository },
  ],
  imports: [RedisModule, RedisStateModule],
})
export class GameModule {}
