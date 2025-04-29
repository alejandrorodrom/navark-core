export interface Shot {
  id: number;
  gameId: number;
  shooterId: number;
  type: ShotType;
  target: {
    row: number;
    col: number;
  };
  hit: boolean;
  sunkShipId?: number;
  createdAt: string;
}

export type ShotType =
  | 'simple'
  | 'cross'
  | 'multi'
  | 'area'
  | 'scan'
  | 'nuclear';
