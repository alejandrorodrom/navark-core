export interface Ship {
  shipId: number;
  ownerId: number | null;
  teamId: number | null;
  positions: Position[];
  isSunk: boolean;
}

export interface Position {
  row: number;
  col: number;
  isHit: boolean;
}

export interface VisibleShip extends Pick<Ship, 'ownerId'> {
  nickname: string;
  color: string;
  positions: Pick<Position, 'row' | 'col'>[];
}

export interface MyShipState extends Pick<Ship, 'shipId' | 'isSunk'> {
  impactedPositions: Pick<Position, 'row' | 'col'>[];
  totalPositions: number;
}
