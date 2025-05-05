import { Injectable } from '@nestjs/common';
import { Board, Difficulty, Mode } from '../../../domain/models/board.model';
import { Ship } from '../../../domain/models/ship.model';

@Injectable()
export class BoardGenerationService {
  /**
   * Genera un único tablero global compartido para todos los jugadores,
   * asegurando que cada jugador tenga la misma cantidad y tamaños de barcos,
   * sin colisiones, y respetando la dificultad.
   */
  generateGlobalBoard(
    playerIds: number[],
    difficulty: Difficulty,
    mode: Mode,
  ): Board {
    const playersCount = playerIds.length;
    const { size, occupationPercentage } = this.getBoardSettings(
      difficulty,
      playersCount,
      mode,
    );

    const totalCells = size * size;
    const maxOccupiedCells = Math.floor(totalCells * occupationPercentage);

    const barcosPorJugador = this.getShipSizesForDifficulty(difficulty);
    const averageShipSize =
      barcosPorJugador.reduce((a, b) => a + b, 0) / barcosPorJugador.length;

    const requiredCells = playersCount * averageShipSize;

    if (requiredCells > maxOccupiedCells) {
      throw new Error(
        'No hay suficiente espacio para colocar todos los barcos sin colisiones.',
      );
    }

    const ships: Ship[] = [];
    let shipId = 1;

    for (const playerId of playerIds) {
      for (const shipSize of barcosPorJugador) {
        let newShip = this.generateRandomShip(size, shipSize, shipId, playerId);

        let attempts = 0;
        while (this.hasCollision(newShip, ships) && attempts < 100) {
          newShip = this.generateRandomShip(size, shipSize, shipId, playerId);
          attempts++;
        }

        if (attempts >= 100) {
          throw new Error(
            'No se pudo colocar todos los barcos sin colisiones.',
          );
        }

        ships.push(newShip);
        shipId++;
      }
    }

    return { size, ships, shots: [] };
  }

  private getBoardSettings(
    difficulty: Difficulty,
    playersCount: number,
    mode: Mode,
  ) {
    let baseSize: number;
    let incrementPerPlayer: number;
    let occupationPercentage: number;

    switch (difficulty) {
      case 'easy':
        baseSize = 10;
        incrementPerPlayer = 1;
        occupationPercentage = 0.7; // 70% ocupado
        break;
      case 'medium':
        baseSize = 12;
        incrementPerPlayer = 1.5;
        occupationPercentage = 0.55; // 55% ocupado
        break;
      case 'hard':
        baseSize = 14;
        incrementPerPlayer = 2;
        occupationPercentage = 0.35; // 35% ocupado
        break;
      default:
        throw new Error('Invalid difficulty');
    }

    if (mode === 'teams') {
      occupationPercentage += 0.05;
    }

    const size = Math.min(
      20,
      Math.ceil(baseSize + playersCount * incrementPerPlayer),
    );

    return { size, occupationPercentage };
  }

  private getShipSizesForDifficulty(difficulty: Difficulty): number[] {
    switch (difficulty) {
      case 'easy':
        return [5, 4, 4, 3, 3];
      case 'medium':
        return [4, 4, 3, 3, 2];
      case 'hard':
        return [3, 3, 2, 2];
      default:
        return [4, 3, 3];
    }
  }

  private generateRandomShip(
    size: number,
    shipSize: number,
    shipId: number,
    ownerId: number,
  ): Ship {
    const horizontal = Math.random() < 0.5;
    const maxStart = size - shipSize;

    let row: number, col: number;

    if (horizontal) {
      row = Math.floor(Math.random() * size);
      col = Math.floor(Math.random() * (maxStart + 1));
    } else {
      row = Math.floor(Math.random() * (maxStart + 1));
      col = Math.floor(Math.random() * size);
    }

    const positions = Array.from({ length: shipSize }, (_, i) => ({
      row: row + (horizontal ? 0 : i),
      col: col + (horizontal ? i : 0),
      isHit: false,
    }));

    return {
      shipId,
      ownerId,
      teamId: null,
      positions,
      isSunk: false,
    };
  }

  private hasCollision(newShip: Ship, existingShips: Ship[]): boolean {
    for (const ship of existingShips) {
      for (const pos of ship.positions) {
        if (
          newShip.positions.some((p) => p.row === pos.row && p.col === pos.col)
        ) {
          return true;
        }
      }
    }
    return false;
  }
}
