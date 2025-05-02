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
