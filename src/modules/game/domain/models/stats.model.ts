import { ShotType } from './shot.model';

export type PlayerStats = {
  userId: number;
  totalShots: number;
  successfulShots: number;
  accuracy: number;
  shipsSunk: number;
  wasWinner: boolean;
  turnsTaken: number;
  shipsRemaining: number;
  wasEliminated: boolean;
  hitStreak: number;
  lastShotWasHit: boolean;
  shotsByType: Record<ShotType, number>;
};
