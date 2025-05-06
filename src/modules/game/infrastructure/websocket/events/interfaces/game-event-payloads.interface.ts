import { GameEvents } from '../constants/game-events.enum';
import { MyShipState, VisibleShip } from '../../../../domain/models/ship.model';
import { VisualShot } from '../../../../domain/models/shot.model';
import { PlayerStats } from '../../../../domain/models/stats.model';

/**
 * Interfaz que define los payloads para todos los eventos del sistema.
 * Esto proporciona tipado seguro al enviar y recibir eventos.
 */
export interface GameEventPayloads {
  // ========== PAYLOADS DE CLIENTE A SERVIDOR ==========

  [GameEvents.PLAYER_JOIN]: {
    gameId: number;
    role?: 'player' | 'spectator';
  };

  [GameEvents.PLAYER_READY]: {
    gameId: number;
  };

  [GameEvents.PLAYER_CHOOSE_TEAM]: {
    gameId: number;
    team: number;
  };

  [GameEvents.PLAYER_LEAVE]: {
    gameId: number;
  };

  [GameEvents.CREATOR_TRANSFER]: {
    gameId: number;
    targetUserId: number;
  };

  [GameEvents.CREATOR_TRANSFER_ACK]: {
    success: boolean;
    error?: string;
  };

  [GameEvents.GAME_START]: {
    gameId: number;
  };

  [GameEvents.GAME_START_ACK]: {
    success: boolean;
    error?: string;
  };

  [GameEvents.PLAYER_FIRE]: {
    gameId: number;
    x: number;
    y: number;
    shotType: 'simple' | 'cross' | 'multi' | 'area' | 'scan' | 'nuclear';
  };

  // ========== PAYLOADS DE SERVIDOR A CLIENTE ==========

  [GameEvents.PLAYER_JOINED]: {
    socketId: string | number;
  };

  [GameEvents.PLAYER_JOINED_ACK]: {
    success: boolean;
    room?: any;
    createdById?: number | null;
    reconnected?: boolean;
    error?: string;
  };

  [GameEvents.SPECTATOR_JOINED_ACK]: {
    success: boolean;
    room?: any;
    createdById?: number | null;
    reconnected?: boolean;
    error?: string;
  };

  [GameEvents.JOIN_DENIED]: {
    reason: string;
  };

  [GameEvents.PLAYER_LEFT]: {
    userId: number;
    nickname: string;
  };

  [GameEvents.CREATOR_CHANGED]: {
    newCreatorUserId: number;
    newCreatorNickname: string;
  };

  [GameEvents.TURN_CHANGED]: {
    userId: number;
  };

  [GameEvents.TURN_TIMEOUT]: {
    userId: number;
  };

  [GameEvents.PLAYER_KICKED]: {
    reason: string;
  };

  [GameEvents.PLAYER_FIRED]: {
    shooterUserId: number;
    x: number;
    y: number;
    hit: boolean;
    sunk: boolean;
  };

  [GameEvents.PLAYER_FIRE_ACK]: {
    success: boolean;
    hit?: boolean;
    sunk?: boolean;
    error?: string;
  };

  [GameEvents.PLAYER_ELIMINATED]: {
    userId: number;
  };

  [GameEvents.NUCLEAR_STATUS]: {
    progress: number;
    hasNuclear: boolean;
    used: boolean;
  };

  [GameEvents.GAME_STARTED]: {
    gameId: number;
  };

  [GameEvents.GAME_ENDED]: {
    mode: 'individual' | 'teams';
    winnerUserId?: number;
    winningTeam?: number;
    stats: PlayerStats[];
  };

  [GameEvents.GAME_ABANDONED]: null;

  [GameEvents.BOARD_UPDATE]: {
    board: {
      size: number;
      ships: VisibleShip[];
      shots: VisualShot[];
      myShips: MyShipState[];
    };
  };

  [GameEvents.PLAYER_READY_ACK]: {
    success: boolean;
  };

  [GameEvents.PLAYER_READY_NOTIFY]: {
    socketId: string;
  };

  [GameEvents.ALL_READY]: null;

  [GameEvents.PLAYER_TEAM_ASSIGNED]: {
    socketId: string;
    team: number;
  };

  [GameEvents.PLAYER_RECONNECTED]: {
    userId: number;
    nickname: string;
  };

  [GameEvents.RECONNECT_ACK]: {
    success: boolean;
  };

  [GameEvents.RECONNECT_FAILED]: {
    reason: string;
  };

  [GameEvents.ERROR]: {
    message: string;
    code?: string;
  };

  [GameEvents.HEARTBEAT]: null;

  [GameEvents.CONNECTION]: undefined;
  [GameEvents.DISCONNECT]: undefined;
}
