import { Module } from '@nestjs/common';

import { ReadyStateRedis } from './ready-state.redis';
import { TeamStateRedis } from './team-state.redis';
import { TurnStateRedis } from './turn-state.redis';
import { NuclearStateRedis } from './nuclear-state.redis';
import { PlayerStateRedis } from './player-state.redis';

@Module({
  providers: [
    ReadyStateRedis,
    PlayerStateRedis,
    TeamStateRedis,
    TurnStateRedis,
    NuclearStateRedis,
  ],
  exports: [
    ReadyStateRedis,
    PlayerStateRedis,
    TeamStateRedis,
    TurnStateRedis,
    NuclearStateRedis,
  ],
})
export class RedisStateModule {}
