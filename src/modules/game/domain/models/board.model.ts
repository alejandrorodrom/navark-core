import { Shot } from './shot.model';
import { Ship } from './ship.model';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Mode = 'individual' | 'teams';

export interface Board {
  size: number;
  ships: Ship[];
  shots: Shot[];
}
