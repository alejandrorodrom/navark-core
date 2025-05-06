import { Module } from '@nestjs/common';
import { GameController } from './infrastructure/http/game.controller';
import { CreateGameService } from './application/services/game-init/create-game.service';
import { MatchmakingService } from './application/services/matchmaking/matchmaking.service';
import { GameFacade } from './application/facade/game.facade';
import { GameRepository } from './domain/repository/game.repository';
import { GamePrismaRepository } from './infrastructure/repository/prisma/game.prisma.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisModule } from '../../redis/redis.module';
import { PlayerRepository } from './domain/repository/player.repository';
import { PlayerPrismaRepository } from './infrastructure/repository/prisma/player.prisma.repository';
import { SpectatorRepository } from './domain/repository/spectator.repository';
import { SpectatorPrismaRepository } from './infrastructure/repository/prisma/spectator.prisma.repository';
import { ShotRepository } from './domain/repository/shot.repository';
import { ShotPrismaRepository } from './infrastructure/repository/prisma/shot.prisma.repository';
import { GameGateway } from './infrastructure/websocket/game.gateway';
import { ConnectionHandler } from './infrastructure/websocket/handlers/connection.handler';
import { ReconnectHandler } from './infrastructure/websocket/handlers/reconnect.handler';
import { CreatorHandler } from './infrastructure/websocket/handlers/creator.handler';
import { FireHandler } from './infrastructure/websocket/handlers/fire.handler';
import { JoinHandler } from './infrastructure/websocket/handlers/join.handler';
import { LeaveHandler } from './infrastructure/websocket/handlers/leave.handler';
import { StartGameHandler } from './infrastructure/websocket/handlers/start-game.handler';
import { BoardHandler } from './infrastructure/websocket/handlers/board.handler';
import { LobbyManagerService } from './infrastructure/services/game/lobby/lobby-manager.service';
import { RedisCleanerService } from './infrastructure/services/game/cleanup/redis-cleaner.service';
import { TurnOrchestratorService } from './infrastructure/services/game/turn/turn-orchestrator.service';
import { TurnTimeoutService } from './infrastructure/services/game/turn/turn-timeout.service';
import { SocketServerAdapter } from './infrastructure/adapters/socket-server.adapter';
import { BoardGenerationService } from './application/services/game-init/board-generation.service';
import { ShotService } from './infrastructure/services/game/fire/shot.service';
import { GameStatsService } from './application/services/stats/game-stats.service';
import { RedisStateModule } from './infrastructure/redis/redis-state.module';
import { GameSocketMapRedisRepository } from './infrastructure/repository/redis/game-socket-map.redis.repository';
import { PlayerEliminationService } from './infrastructure/services/game/turn/player-elimination.service';
import { GameEventEmitter } from './infrastructure/websocket/events/emitters/game-event.emitter';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameService,
    MatchmakingService,

    GameFacade,

    GameGateway,

    SocketServerAdapter,
    GameEventEmitter,

    ConnectionHandler,
    ReconnectHandler,
    CreatorHandler,
    FireHandler,
    JoinHandler,
    LeaveHandler,
    StartGameHandler,
    BoardHandler,

    LobbyManagerService,
    RedisCleanerService,

    PlayerEliminationService,
    TurnOrchestratorService,
    TurnTimeoutService,

    BoardGenerationService,
    ShotService,
    GameStatsService,

    GameSocketMapRedisRepository,
    { provide: GameRepository, useClass: GamePrismaRepository },
    { provide: PlayerRepository, useClass: PlayerPrismaRepository },
    { provide: ShotRepository, useClass: ShotPrismaRepository },
    { provide: SpectatorRepository, useClass: SpectatorPrismaRepository },
  ],
  imports: [RedisModule, RedisStateModule],
})
export class GameModule {}
