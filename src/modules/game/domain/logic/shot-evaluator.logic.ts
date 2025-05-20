import { Injectable } from '@nestjs/common';
import { Ship } from '../models/ship.model';
import { ShotResult, ShotTarget, ShotType } from '../models/shot.model';

/**
 * Servicio especializado en la evaluación de disparos en el tablero de juego.
 *
 * Este servicio contiene funciones puras del dominio que:
 * - Evalúan impactos en barcos
 * - Generan coordenadas afectadas por diferentes tipos de disparo
 * - Determinan si una coordenada impacta a un aliado
 * - Convierten el formato de Redis (string) a formato limpio de dominio (number)
 */
@Injectable()
export class ShotEvaluatorLogic {
  /**
   * Evalúa un disparo contra todos los barcos del tablero.
   * Si impacta un barco, marca la posición como impactada.
   * Si se impactan todas las posiciones del barco, se marca como hundido.
   *
   * @param ships Lista de barcos presentes en el tablero
   * @param row Fila del disparo
   * @param col Columna del disparo
   * @returns Resultado del disparo: hit true/false y sunkShipId si aplica
   */
  static evaluate(ships: Ship[], row: number, col: number): ShotResult {
    for (const ship of ships) {
      for (const pos of ship.positions) {
        if (pos.row === row && pos.col === col && !pos.isHit && !ship.isSunk) {
          pos.isHit = true;

          // Si todas las posiciones del barco están impactadas, el barco se hunde
          if (ship.positions.every((p) => p.isHit)) {
            ship.isSunk = true;
            return { hit: true, sunkShipId: ship.shipId };
          }

          return { hit: true };
        }
      }
    }

    // Si no se impactó ningún barco
    return { hit: false };
  }

  /**
   * Genera las coordenadas objetivo que deben ser evaluadas según el tipo de disparo.
   * Asegura que todas las coordenadas generadas estén dentro de los límites del tablero.
   *
   * @param type Tipo de disparo ('simple', 'cross', 'multi', 'area', 'nuclear')
   * @param origin Coordenada base del disparo
   * @param boardSize Tamaño del tablero
   * @returns Arreglo de coordenadas válidas para evaluar
   */
  generateTargetsForShotType(
    type: ShotType,
    origin: ShotTarget,
    boardSize: number,
  ): ShotTarget[] {
    const targets: ShotTarget[] = [];
    const { row, col } = origin;

    // Función auxiliar para validar límites del tablero
    const isValid = (r: number, c: number) =>
      r >= 0 && r < boardSize && c >= 0 && c < boardSize;

    switch (type) {
      case 'simple':
        if (isValid(row, col)) targets.push({ row, col });
        break;

      case 'cross':
        // Centro y 4 direcciones cardinales (forma de cruz)
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
        // Disparo central + 2 posiciones aleatorias cercanas
        targets.push({ row, col });
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
        // Cuadrado 2x2 desde la coordenada base
        for (let dr = 0; dr < 2; dr++) {
          for (let dc = 0; dc < 2; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (isValid(r, c)) targets.push({ row: r, col: c });
          }
        }
        break;

      case 'nuclear': {
        // Forma de rombo con radio 3 (6x6)
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
        // Por defecto, solo la coordenada central
        if (isValid(row, col)) targets.push({ row, col });
        break;
    }

    return targets;
  }

  /**
   * Verifica si una posición afecta a un barco aliado.
   * Considera aliados como:
   * - El mismo jugador
   * - Jugadores que estén en el mismo equipo
   *
   * @param ships Lista de barcos en el tablero
   * @param row Fila objetivo
   * @param col Columna objetivo
   * @param shooterId ID del jugador que dispara
   * @param teams Mapa de userId a teamId
   * @returns true si hay un barco aliado en esa posición
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
   * Convierte un mapa de Redis (con claves tipo socketId-userId)
   * a un mapa de userId numérico para uso en el dominio.
   *
   * @param teamsRecord Mapa de Redis (Record<string, number>)
   * @returns Mapa limpio (Record<number, number>) con userId como clave
   */
  convertTeamsFormat(
    teamsRecord: Record<string, number>,
  ): Record<number, number> {
    const result: Record<number, number> = {};

    for (const [key, teamId] of Object.entries(teamsRecord)) {
      // Se extrae el último segmento como userId
      const userId = parseInt(key.split('-').pop() || '', 10);
      if (!isNaN(userId)) result[userId] = teamId;
    }

    return result;
  }
}
