export type Difficulty = 'easy' | 'medium' | 'hard';

export type Mode = 'individual' | 'teams';

export interface Ship {
  shipId: number;
  ownerId: number | null;
  teamId: number | null;
  positions: Position[];
  isSunk: boolean;
}

export interface Board {
  size: number;
  ships: Ship[];
}

export interface Position {
  row: number;
  col: number;
  isHit: boolean;
}
