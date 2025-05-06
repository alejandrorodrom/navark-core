/**
 * Enumeración de todos los eventos WebSocket disponibles en el sistema de juego.
 * Organizados por categorías para mejor mantenibilidad.
 */
export enum GameEvents {
  // ========== EVENTOS DE CLIENTE A SERVIDOR ==========

  // Eventos de Unión y Sala
  PLAYER_JOIN = 'player:join',
  PLAYER_READY = 'player:ready',
  PLAYER_CHOOSE_TEAM = 'player:chooseTeam',
  PLAYER_LEAVE = 'player:leave',

  // Eventos de Control de Juego
  GAME_START = 'game:start',
  GAME_START_ACK = 'game:start:ack',
  PLAYER_FIRE = 'player:fire',
  CREATOR_TRANSFER = 'creator:transfer',
  CREATOR_TRANSFER_ACK = 'creator:transfer:ack',

  // ========== EVENTOS DE SERVIDOR A CLIENTE ==========

  // Confirmaciones y Respuestas
  PLAYER_JOINED = 'player:joined',
  PLAYER_JOINED_ACK = 'player:joined:ack',
  SPECTATOR_JOINED_ACK = 'spectator:joined:ack',
  JOIN_DENIED = 'join:denied',
  PLAYER_READY_ACK = 'player:ready:ack',
  PLAYER_READY_NOTIFY = 'player:ready:notify',
  PLAYER_FIRE_ACK = 'player:fire:ack',
  RECONNECT_ACK = 'reconnect:ack',
  RECONNECT_FAILED = 'reconnect:failed',

  // Eventos de Estado de Juego
  PLAYER_LEFT = 'player:left',
  CREATOR_CHANGED = 'creator:changed',
  TURN_CHANGED = 'turn:changed',
  TURN_TIMEOUT = 'turn:timeout',
  PLAYER_KICKED = 'player:kicked',
  PLAYER_FIRED = 'player:fired',
  PLAYER_ELIMINATED = 'player:eliminated',
  NUCLEAR_STATUS = 'nuclear:status',
  GAME_STARTED = 'game:started',
  GAME_ENDED = 'game:ended',
  GAME_ABANDONED = 'game:abandoned',
  BOARD_UPDATE = 'board:update',
  ALL_READY = 'all:ready',
  PLAYER_TEAM_ASSIGNED = 'player:teamAssigned',
  PLAYER_RECONNECTED = 'player:reconnected',

  // Eventos del Sistema
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}
