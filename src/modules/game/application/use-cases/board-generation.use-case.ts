import { Injectable, Logger } from '@nestjs/common';
import { Board, Difficulty, Mode } from '../../domain/models/board.model';
import { Position, Ship } from '../../domain/models/ship.model';

/**
 * Caso de uso responsable de generar un tablero global de juego.
 *
 * Este tablero incluye:
 * - Dimensiones calculadas dinámicamente según dificultad, cantidad de jugadores y modo
 * - Barcos generados aleatoriamente por jugador, sin colisiones
 *
 * La generación respeta restricciones como límite de ocupación del tablero
 * y número máximo de intentos para evitar colisiones.
 */
@Injectable()
export class BoardGenerationUseCase {
  private readonly logger = new Logger(BoardGenerationUseCase.name);

  private readonly MAX_PLACEMENT_ATTEMPTS = 100;
  private readonly MAX_BOARD_SIZE = 20;

  /**
   * Genera un tablero con todos los barcos colocados para todos los jugadores.
   *
   * @param playerIds Lista de IDs de los jugadores que participarán en la partida.
   * @param difficulty Nivel de dificultad ('easy', 'medium', 'hard') que afecta tamaño del tablero y tipo de barcos.
   * @param mode Modo de juego ('individual' o 'teams'), utilizado para ajustar la densidad del tablero.
   *
   * @returns Objeto `Board` que incluye tamaño, barcos y disparos inicializados.
   * @throws Error si no es posible colocar todos los barcos sin colisiones.
   */
  generateGlobalBoard(
    playerIds: number[],
    difficulty: Difficulty,
    mode: Mode,
  ): Board {
    const playersCount = playerIds.length;

    // 1. Determinar el tamaño del tablero y porcentaje máximo de ocupación
    const { size, occupationPercentage } = this.getBoardSettings(
      difficulty,
      playersCount,
      mode,
    );

    this.logger.log(
      `Generando tablero: ${size}x${size}, dificultad=${difficulty}, jugadores=${playersCount}, modo=${mode}`,
    );

    // 2. Calcular el número máximo de celdas ocupables en el tablero
    const totalCells = size * size;
    const maxOccupiedCells = Math.floor(totalCells * occupationPercentage);

    // 3. Obtener la lista de tamaños de barcos por jugador según dificultad
    const shipSizesPerPlayer = this.getShipSizesForDifficulty(difficulty);

    // 4. Calcular el tamaño promedio de un barco
    const averageShipSize =
      shipSizesPerPlayer.reduce((a, b) => a + b, 0) / shipSizesPerPlayer.length;

    // 5. Estimar cuántas celdas se necesitarían en total para todos los barcos
    const requiredCells =
      playersCount * averageShipSize * shipSizesPerPlayer.length;

    // 6. Validar si hay suficiente espacio disponible
    if (requiredCells > maxOccupiedCells) {
      this.logger.error(
        `Espacio insuficiente: Requerido=${requiredCells}, Disponible=${maxOccupiedCells}`,
      );
      throw new Error(
        'No hay suficiente espacio para colocar todos los barcos sin colisiones.',
      );
    }

    // 7. Iniciar el proceso de colocación de barcos
    const ships: Ship[] = [];
    const occupiedPositions = new Set<string>();
    let shipId = 1;

    for (const playerId of playerIds) {
      for (const shipSize of shipSizesPerPlayer) {
        let newShip = this.generateRandomShip(size, shipSize, shipId, playerId);
        let attempts = 0;

        // 8. Reintentar hasta ubicar un barco sin colisiones o agotar intentos
        while (
          this.hasCollisionWithSet(newShip, occupiedPositions) &&
          attempts < this.MAX_PLACEMENT_ATTEMPTS
        ) {
          newShip = this.generateRandomShip(size, shipSize, shipId, playerId);
          attempts++;
        }

        // 9. Si se superan los intentos máximos, lanzar error
        if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
          this.logger.error(
            `No se pudo colocar barco: playerId=${playerId}, shipSize=${shipSize}, intentos=${attempts}`,
          );
          throw new Error(
            'No se pudo colocar todos los barcos sin colisiones.',
          );
        }

        ships.push(newShip);

        // 10. Registrar todas las posiciones del barco en el Set
        for (const pos of newShip.positions) {
          occupiedPositions.add(`${pos.row}:${pos.col}`);
        }

        shipId++;
      }
    }

    // 11. Finalizar tablero
    this.logger.log(
      `Tablero generado exitosamente: ${ships.length} barcos colocados`,
    );

    return { size, ships, shots: [] };
  }

  /**
   * Devuelve la configuración del tablero (tamaño y densidad) según dificultad, modo y número de jugadores.
   *
   * @param difficulty Nivel de dificultad seleccionado.
   * @param playersCount Número total de jugadores.
   * @param mode Modo de juego.
   *
   * @returns Objeto con el tamaño del tablero y el porcentaje de ocupación permitido.
   * @throws Error si la dificultad no es válida.
   */
  private getBoardSettings(
    difficulty: Difficulty,
    playersCount: number,
    mode: Mode,
  ): { size: number; occupationPercentage: number } {
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
        this.logger.error(`Dificultad no válida`);
        throw new Error('Dificultad no válida');
    }

    if (mode === 'teams') {
      occupationPercentage += 0.05;
    }

    const size = Math.min(
      this.MAX_BOARD_SIZE,
      Math.ceil(baseSize + playersCount * incrementPerPlayer),
    );

    return { size, occupationPercentage };
  }

  /**
   * Determina los tamaños de los barcos por jugador según la dificultad.
   *
   * @param difficulty Nivel de dificultad.
   * @returns Arreglo de longitudes de barcos.
   */
  private getShipSizesForDifficulty(difficulty: Difficulty): number[] {
    switch (difficulty) {
      case 'easy':
        return [5, 4, 3, 2, 2, 1, 1];
      case 'medium':
        return [4, 4, 3, 3, 2, 2, 1];
      case 'hard':
        return [4, 3, 2, 2, 1];
      default:
        this.logger.warn(
          'Dificultad no reconocida: Usando configuración por defecto',
        );
        return [4, 3, 3];
    }
  }

  /**
   * Genera un barco con orientación y posición aleatoria.
   *
   * @param boardSize Tamaño del tablero.
   * @param shipSize Tamaño del barco.
   * @param shipId ID único del barco.
   * @param ownerId ID del jugador propietario del barco.
   * @returns Objeto `Ship` con las posiciones generadas.
   */
  private generateRandomShip(
    boardSize: number,
    shipSize: number,
    shipId: number,
    ownerId: number,
  ): Ship {
    const horizontal = Math.random() < 0.5;
    const maxStart = boardSize - shipSize;

    let row: number, col: number;

    if (horizontal) {
      row = Math.floor(Math.random() * boardSize);
      col = Math.floor(Math.random() * (maxStart + 1));
    } else {
      row = Math.floor(Math.random() * (maxStart + 1));
      col = Math.floor(Math.random() * boardSize);
    }

    const positions: Position[] = Array.from({ length: shipSize }, (_, i) => ({
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

  /**
   * Verifica si un barco colisiona con las posiciones ya ocupadas usando un Set.
   *
   * @param ship Barco a verificar.
   * @param occupied Set de posiciones ocupadas (formato "row:col").
   * @returns true si hay colisión, false si no.
   */
  private hasCollisionWithSet(ship: Ship, occupied: Set<string>): boolean {
    return ship.positions.some((pos) => occupied.has(`${pos.row}:${pos.col}`));
  }
}
