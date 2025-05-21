import { Injectable } from '@nestjs/common';
import { Ship } from '../models/ship.model';
import { ShotResult, ShotTarget, ShotType } from '../models/shot.model';

/**
 * Servicio especializado en la evaluación de disparos en el tablero de juego.
 *
 * Contiene lógica pura del dominio relacionada con:
 * - Impacto de disparos
 * - Generación de coordenadas según tipo de disparo
 * - Validación de disparo sobre barcos aliados
 * - Conversión de formatos desde Redis
 */
@Injectable()
export class ShotEvaluatorLogic {
  /**
   * Evalúa un disparo contra los barcos del tablero.
   *
   * Marca como impactada la posición y si todas las posiciones están impactadas,
   * marca el barco como hundido.
   *
   * @param ships Lista de barcos presentes en el tablero.
   * @param row Fila objetivo del disparo.
   * @param col Columna objetivo del disparo.
   * @returns Resultado del disparo (acierto, y si fue hundimiento).
   */
  static evaluate(ships: Ship[], row: number, col: number): ShotResult {
    for (const ship of ships) {
      for (const pos of ship.positions) {
        if (pos.row === row && pos.col === col && !pos.isHit && !ship.isSunk) {
          pos.isHit = true;

          if (ship.positions.every((p) => p.isHit)) {
            ship.isSunk = true;
            return { hit: true, sunkShipId: ship.shipId };
          }

          return { hit: true };
        }
      }
    }

    return { hit: false };
  }

  /**
   * Genera las coordenadas objetivo según el tipo de disparo.
   *
   * Tipo de disparo y su patrón de área:
   * - `'simple'`: solo la coordenada indicada.
   * - `'cross'`: forma de cruz (+), incluye la coordenada central y 4 adyacentes.
   * - `'multi'`: coordenada central + 2 aleatorias cercanas.
   * - `'area'`: cuadrado 2x2 desde la coordenada base.
   * - `'nuclear'`: rombo con radio 3 (área de 6x6 aprox).
   *
   * @param type Tipo de disparo.
   * @param origin Coordenada base del disparo.
   * @param boardSize Dimensión del tablero (N x N).
   * @returns Lista de coordenadas válidas dentro del tablero.
   */
  generateTargetsForShotType(
    type: ShotType,
    origin: ShotTarget,
    boardSize: number,
  ): ShotTarget[] {
    const targets: ShotTarget[] = [];
    const { row, col } = origin;

    const isValid = (r: number, c: number) =>
      r >= 0 && r < boardSize && c >= 0 && c < boardSize;

    switch (type) {
      case 'simple':
        if (isValid(row, col)) targets.push({ row, col });
        break;

      case 'cross':
        [
          [0, 0],
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ].forEach(([dr, dc]) => {
          const r = row + dr;
          const c = col + dc;
          if (isValid(r, c)) targets.push({ row: r, col: c });
        });
        break;

      case 'multi': {
        targets.push({ row, col }); // Centro
        const offsets: [number, number][] = [];

        for (let i = 0; i < 10 && offsets.length < 2; i++) {
          const dr = Math.floor(Math.random() * 5) - 2;
          const dc = Math.floor(Math.random() * 5) - 2;

          if ((dr || dc) && !offsets.some(([r, c]) => r === dr && c === dc)) {
            const r = row + dr;
            const c = col + dc;
            if (isValid(r, c)) {
              offsets.push([dr, dc]);
              targets.push({ row: r, col: c });
            }
          }
        }
        break;
      }

      case 'area':
        for (let dr = 0; dr < 2; dr++) {
          for (let dc = 0; dc < 2; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (isValid(r, c)) targets.push({ row: r, col: c });
          }
        }
        break;

      case 'nuclear': {
        const radius = 3;
        for (let dr = -radius; dr <= radius; dr++) {
          const maxCol = radius - Math.abs(dr);
          for (let dc = -maxCol; dc <= maxCol; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (isValid(r, c)) targets.push({ row: r, col: c });
          }
        }
        break;
      }

      default:
        if (isValid(row, col)) targets.push({ row, col });
        break;
    }

    return targets;
  }

  /**
   * Determina si una coordenada impactaría un barco aliado.
   *
   * Considera aliados como:
   * - El propio jugador (disparo sobre sus propios barcos)
   * - Compañeros de equipo (según el mapa `teams`)
   *
   * @param ships Lista completa de barcos en el tablero.
   * @param row Fila objetivo.
   * @param col Columna objetivo.
   * @param shooterId ID del jugador que dispara.
   * @param teams Mapa de userId → teamId.
   * @returns `true` si hay un barco aliado en esa posición.
   */
  isAlliedShipPosition(
    ships: Ship[],
    row: number,
    col: number,
    shooterId: number,
    teams: Record<number, number>,
  ): boolean {
    const shooterTeam = teams[shooterId];

    return ships.some((ship) => {
      if (ship.ownerId === shooterId) return true;

      if (ship.ownerId && teams[ship.ownerId] === shooterTeam) {
        return ship.positions.some((pos) => pos.row === row && pos.col === col);
      }

      return false;
    });
  }

  /**
   * Convierte un mapa de Redis con claves tipo `socketId-userId`
   * a un mapa plano de `userId: teamId`.
   *
   * Ejemplo de entrada: `{ "socket-23": 1, "socket-45": 2 }`
   * Salida: `{ 23: 1, 45: 2 }`
   *
   * @param teamsRecord Mapa de Redis con claves string.
   * @returns Mapa limpio con claves numéricas.
   */
  convertTeamsFormat(
    teamsRecord: Record<string, number>,
  ): Record<number, number> {
    const result: Record<number, number> = {};

    for (const [key, teamId] of Object.entries(teamsRecord)) {
      const userId = parseInt(key.split('-').pop() || '', 10);
      if (!isNaN(userId)) result[userId] = teamId;
    }

    return result;
  }
}
