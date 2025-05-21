import { Board } from '../../domain/models/board.model';

/**
 * Transforma un valor crudo (`string` o `unknown`) en una instancia del modelo `Board`.
 *
 * Esta función es útil para convertir la representación serializada del tablero
 * (como se guarda en la base de datos) en un objeto manipulable dentro del dominio.
 *
 * Si el valor ya es un objeto, simplemente se devuelve como `Board`.
 *
 * @param raw Valor recibido que representa el tablero. Puede ser un string JSON o un objeto ya tipado.
 * @returns Objeto `Board` deserializado y listo para ser utilizado.
 */
export function parseBoard(raw: unknown): Board {
  // Si es un string, se asume que es JSON serializado y se parsea
  if (typeof raw === 'string') {
    return JSON.parse(raw) as Board;
  }

  // Si ya es un objeto, se retorna directamente con cast a Board
  return raw as Board;
}
