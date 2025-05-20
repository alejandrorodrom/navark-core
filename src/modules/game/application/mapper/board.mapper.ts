import { Board } from '../../domain/models/board.model';

/**
 * Convierte un string o unknown en un objeto Board.
 */
export function parseBoard(raw: unknown): Board {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as Board;
  }
  return raw as Board;
}
