import { Module } from '@nestjs/common';
import { GameController } from './infrastructure/http/game.controller';
import { CreateGameUseCase } from './application/use-cases/create-game.use-case';
import { MatchmakingUseCase } from './application/use-cases/matchmaking.use-case';
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
import { LobbyManager } from './infrastructure/managers/lobby.manager';
import { RedisCleanerOrchestrator } from './infrastructure/orchestrators/redis-cleaner.orchestrator';
import { TurnOrchestrator } from './infrastructure/orchestrators/turn.orchestrator';
import { TurnTimeoutManager } from './infrastructure/managers/turn-timeout.manager';
import { SocketServerAdapter } from './infrastructure/adapters/socket-server.adapter';
import { BoardGenerationUseCase } from './application/use-cases/board-generation.use-case';
import { FireShotUseCase } from './application/use-cases/fire-shot.use-case';
import { RedisStateModule } from './infrastructure/redis/redis-state.module';
import { GameSocketMapRedisRepository } from './infrastructure/repository/redis/game-socket-map.redis.repository';
import { PlayerEliminationManager } from './infrastructure/managers/player-elimination.manager';
import { GameEventEmitter } from './infrastructure/websocket/events/emitters/game-event.emitter';
import { StatsModule } from '../stats/stats.module';
import { BoardVisualizationUseCase } from './application/use-cases/board-visualization.use-case';
import { ShotEvaluatorLogic } from './domain/logic/shot-evaluator.logic';

@Module({
  controllers: [GameController],
  providers: [
    PrismaService,
    CreateGameUseCase,
    MatchmakingUseCase,
    BoardVisualizationUseCase,

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

    LobbyManager,
    RedisCleanerOrchestrator,

    PlayerEliminationManager,
    TurnOrchestrator,
    TurnTimeoutManager,

    BoardGenerationUseCase,
    FireShotUseCase,
    ShotEvaluatorLogic,

    GameSocketMapRedisRepository,
    { provide: GameRepository, useClass: GamePrismaRepository },
    { provide: PlayerRepository, useClass: PlayerPrismaRepository },
    { provide: ShotRepository, useClass: ShotPrismaRepository },
    { provide: SpectatorRepository, useClass: SpectatorPrismaRepository },
  ],
  imports: [RedisModule, RedisStateModule, StatsModule],
})
export class GameModule {}
