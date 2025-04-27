import { Injectable, Logger } from '@nestjs/common';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { ReadyStateRedis } from '../redis/ready-state.redis';
import { TeamStateRedis } from '../redis/team-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';

@Injectable()
export class RedisUtils {
  private readonly logger = new Logger(RedisUtils.name);

  constructor(
    private readonly turnStateRedis: TurnStateRedis,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamsStateRedis: TeamStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
  ) {}

  async clearGameRedisState(gameId: number): Promise<void> {
    await Promise.all([
      this.readyStateRedis.clearReady(gameId),
      this.teamsStateRedis.clearTeams(gameId),
      this.turnStateRedis.clearTurn(gameId),
      this.nuclearStateRedis.clearNuclear(gameId),
    ]);

    this.logger.log(
      `Limpieza de estado Redis completada para partida ${gameId}`,
    );
  }
}
