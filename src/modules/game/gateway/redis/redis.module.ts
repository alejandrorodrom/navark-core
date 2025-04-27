import { Module } from '@nestjs/common';
import { RedisService } from '../../../../redis/redis.service';

import { ReadyStateRedis } from './ready-state.redis';
import { TeamStateRedis } from './team-state.redis';
import { TurnStateRedis } from './turn-state.redis';
import { NuclearStateRedis } from './nuclear-state.redis';

@Module({
  providers: [
    RedisService,
    ReadyStateRedis,
    TeamStateRedis,
    TurnStateRedis,
    NuclearStateRedis,
  ],
  exports: [ReadyStateRedis, TeamStateRedis, TurnStateRedis, NuclearStateRedis],
})
export class RedisModule {}
