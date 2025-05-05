import { Game, GamePlayer, Spectator, User } from '../../generated/prisma';

export type {
  User,
  Game,
  GamePlayer,
  Spectator,
  Shot,
} from '../../generated/prisma';

export type GameWithPlayers = Game & { gamePlayers: GamePlayer[] };

export type GameWithPlayersAndUsers = Game & {
  gamePlayers: (GamePlayer & { user: User })[];
};

export type GameWithPlayersAndSpectator = Game & {
  gamePlayers: GamePlayer[];
  spectators: Spectator[];
};
