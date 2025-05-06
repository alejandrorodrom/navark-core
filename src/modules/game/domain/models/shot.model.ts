export interface Shot extends ShotResult {
  id: number;
  gameId: number;
  shooterId: number;
  type: ShotType;
  target: ShotTarget;
  createdAt: string;
}

export type ShotTarget = {
  row: number;
  col: number;
};

export type ShotType = 'simple' | 'cross' | 'multi' | 'area' | 'nuclear';

export type ShotResult = {
  hit: boolean;
  sunkShipId?: number;
};

export interface VisualShot extends ShotTarget {
  result: 'hit' | 'miss';
}
