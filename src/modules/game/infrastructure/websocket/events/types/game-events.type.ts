import { GameEvents } from '../constants/game-events.enum';

/**
 * Tipo que agrupa los eventos entrantes (Cliente -> Servidor)
 */
export type ClientToServerEvent =
  | GameEvents.PLAYER_JOIN
  | GameEvents.PLAYER_READY
  | GameEvents.PLAYER_CHOOSE_TEAM
  | GameEvents.PLAYER_LEAVE
  | GameEvents.GAME_START
  | GameEvents.PLAYER_FIRE
  | GameEvents.CREATOR_TRANSFER;

/**
 * Tipo que agrupa los eventos salientes (Servidor -> Cliente)
 */
export type ServerToClientEvent = Exclude<GameEvents, ClientToServerEvent>;
