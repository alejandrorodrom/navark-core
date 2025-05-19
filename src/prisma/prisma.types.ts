import {
  Game,
  GamePlayer,
  Spectator,
  User,
  Prisma,
  GamePlayerStats,
} from '../../generated/prisma';

export type {
  User,
  Game,
  GamePlayer,
  Spectator,
  Shot,
  GamePlayerStats,
  UserGlobalStats,
} from '../../generated/prisma';

export type GamePlayerWithUser = GamePlayer & { user: User };

export type GameWithPlayers = Game & { gamePlayers: GamePlayer[] };

export type GameWithPlayersAndUsers = Game & {
  gamePlayers: GamePlayerWithUser[];
};

export type GameWithPlayersAndSpectator = Game & {
  gamePlayers: GamePlayer[];
  spectators: Spectator[];
};

export type GamePlayerStatsWithUser = GamePlayerStats & {
  user: Pick<User, 'nickname'>;
};

export type GamePlayerStatsWithGame = GamePlayerStats & {
  game: Pick<Game, 'id' | 'mode' | 'createdAt'>;
};

export type GamePlayerStatsCreateInput = Prisma.GamePlayerStatsCreateInput;
