import { Injectable, Logger } from '@nestjs/common';
import { Board, Difficulty, Mode } from '../../../domain/models/board.model';
import { Position, Ship } from '../../../domain/models/ship.model';

/**
 * Servicio responsable de la generación de tableros de juego y colocación
 * aleatoria de barcos respetando las reglas del juego.
 *
 * Este servicio implementa algoritmos para:
 * - Calcular el tamaño óptimo del tablero según dificultad y número de jugadores
 * - Determinar la cantidad y tamaño de barcos para cada dificultad
 * - Colocar barcos aleatoriamente sin colisiones
 * - Adaptar la densidad del tablero según el modo de juego
 */
@Injectable()
export class BoardGenerationService {
  private readonly logger = new Logger(BoardGenerationService.name);

  /** Límite de intentos para colocar barcos sin colisiones */
  private readonly MAX_PLACEMENT_ATTEMPTS = 100;

  /** Tamaño máximo permitido para un tablero */
  private readonly MAX_BOARD_SIZE = 20;

  /**
   * Genera un tablero global compartido para todos los jugadores participantes.
   *
   * Este método:
   * 1. Calcula el tamaño adecuado del tablero según la dificultad y cantidad de jugadores
   * 2. Determina el espacio máximo que pueden ocupar los barcos
   * 3. Distribuye barcos de tamaños adecuados para cada jugador
   * 4. Coloca los barcos aleatoriamente evitando colisiones
   *
   * El tablero resultante contiene todos los barcos para todos los jugadores,
   * cada uno identificado con su propietario correspondiente.
   *
   * @param playerIds Array con los IDs de los jugadores participantes
   * @param difficulty Nivel de dificultad que afecta el tamaño del tablero y los barcos
   * @param mode Modo de juego (individual o equipos)
   * @returns Tablero completo con todos los barcos colocados
   * @throws Error si no es posible colocar todos los barcos sin colisiones
   */
  generateGlobalBoard(
    playerIds: number[],
    difficulty: Difficulty,
    mode: Mode,
  ): Board {
    const playersCount = playerIds.length;

    // Obtener configuración del tablero según dificultad y modo
    const { size, occupationPercentage } = this.getBoardSettings(
      difficulty,
      playersCount,
      mode,
    );

    this.logger.log(
      `Generando tablero: ${size}x${size}, dificultad=${difficulty}, jugadores=${playersCount}, modo=${mode}`,
    );

    // Calcular capacidad del tablero
    const totalCells = size * size;
    const maxOccupiedCells = Math.floor(totalCells * occupationPercentage);

    // Determinar tamaños de barcos según dificultad
    const shipSizesPerPlayer = this.getShipSizesForDifficulty(difficulty);
    const averageShipSize =
      shipSizesPerPlayer.reduce((a, b) => a + b, 0) / shipSizesPerPlayer.length;

    // Verificar si hay suficiente espacio para todos los barcos
    const requiredCells =
      playersCount * averageShipSize * shipSizesPerPlayer.length;

    if (requiredCells > maxOccupiedCells) {
      this.logger.error(
        `Espacio insuficiente: Requerido=${requiredCells}, Disponible=${maxOccupiedCells}`,
      );
      throw new Error(
        'No hay suficiente espacio para colocar todos los barcos sin colisiones.',
      );
    }

    // Generar y colocar barcos para cada jugador
    const ships: Ship[] = [];
    let shipId = 1;

    for (const playerId of playerIds) {
      for (const shipSize of shipSizesPerPlayer) {
        let newShip = this.generateRandomShip(size, shipSize, shipId, playerId);
        let attempts = 0;

        // Intentar colocar el barco sin colisiones
        while (
          this.hasCollision(newShip, ships) &&
          attempts < this.MAX_PLACEMENT_ATTEMPTS
        ) {
          newShip = this.generateRandomShip(size, shipSize, shipId, playerId);
          attempts++;
        }

        // Verificar si se superó el límite de intentos
        if (attempts >= this.MAX_PLACEMENT_ATTEMPTS) {
          this.logger.error(
            `No se pudo colocar barco: playerId=${playerId}, shipSize=${shipSize}, intentos=${attempts}`,
          );
          throw new Error(
            'No se pudo colocar todos los barcos sin colisiones.',
          );
        }

        ships.push(newShip);
        shipId++;
      }
    }

    this.logger.log(
      `Tablero generado exitosamente: ${ships.length} barcos colocados`,
    );

    return { size, ships, shots: [] };
  }

  /**
   * Determina las dimensiones y capacidad del tablero según la dificultad,
   * número de jugadores y modo de juego.
   *
   * Los parámetros clave calculados son:
   * - Tamaño del tablero (dimensión del cuadrado)
   * - Porcentaje de ocupación máxima permitida
   *
   * @param difficulty Nivel de dificultad (fácil, medio, difícil)
   * @param playersCount Número de jugadores en la partida
   * @param mode Modo de juego (individual o equipos)
   * @returns Configuración con tamaño y porcentaje de ocupación
   * @private
   */
  private getBoardSettings(
    difficulty: Difficulty,
    playersCount: number,
    mode: Mode,
  ): { size: number; occupationPercentage: number } {
    let baseSize: number;
    let incrementPerPlayer: number;
    let occupationPercentage: number;

    // Configurar parámetros base según dificultad
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

    // Permitir más densidad de barcos en modo equipos
    if (mode === 'teams') {
      occupationPercentage += 0.05;
    }

    // Calcular tamaño final con límite máximo
    const size = Math.min(
      this.MAX_BOARD_SIZE,
      Math.ceil(baseSize + playersCount * incrementPerPlayer),
    );

    return { size, occupationPercentage };
  }

  /**
   * Determina la cantidad y tamaño de barcos a generar para cada jugador
   * según el nivel de dificultad seleccionado.
   *
   * En dificultades más altas, se generan barcos más pequeños que son
   * más difíciles de encontrar y hundir.
   *
   * @param difficulty Nivel de dificultad
   * @returns Array con los tamaños de barcos a generar
   * @private
   */
  private getShipSizesForDifficulty(difficulty: Difficulty): number[] {
    switch (difficulty) {
      case 'easy':
        return [5, 4, 4, 3, 3]; // Barcos más grandes son más fáciles de encontrar
      case 'medium':
        return [4, 4, 3, 3, 2];
      case 'hard':
        return [3, 3, 2, 2]; // Barcos más pequeños son más difíciles de encontrar
      default:
        this.logger.warn(
          `Dificultad no reconocida: Usando valores por defecto`,
        );
        return [4, 3, 3]; // Configuración por defecto
    }
  }

  /**
   * Genera un barco de tamaño específico en una posición aleatoria
   * con orientación aleatoria (horizontal o vertical).
   *
   * @param boardSize Tamaño del tablero
   * @param shipSize Longitud del barco a generar
   * @param shipId Identificador único del barco
   * @param ownerId ID del jugador propietario del barco
   * @returns Objeto Ship con todas sus posiciones
   * @private
   */
  private generateRandomShip(
    boardSize: number,
    shipSize: number,
    shipId: number,
    ownerId: number,
  ): Ship {
    // Determinar orientación aleatoria
    const horizontal = Math.random() < 0.5;
    const maxStart = boardSize - shipSize;

    let row: number, col: number;

    // Calcular posición inicial según orientación
    if (horizontal) {
      row = Math.floor(Math.random() * boardSize);
      col = Math.floor(Math.random() * (maxStart + 1));
    } else {
      row = Math.floor(Math.random() * (maxStart + 1));
      col = Math.floor(Math.random() * boardSize);
    }

    // Generar todas las posiciones que ocupa el barco
    const positions: Position[] = Array.from({ length: shipSize }, (_, i) => ({
      row: row + (horizontal ? 0 : i),
      col: col + (horizontal ? i : 0),
      isHit: false,
    }));

    return {
      shipId,
      ownerId,
      teamId: null, // Se asignará después si es modo equipos
      positions,
      isSunk: false,
    };
  }

  /**
   * Verifica si un barco nuevo colisiona con alguno de los barcos ya colocados.
   * Una colisión ocurre cuando dos barcos ocupan la misma celda del tablero.
   *
   * @param newShip Barco que se intenta colocar
   * @param existingShips Lista de barcos ya colocados
   * @returns true si hay colisión, false si el barco puede colocarse
   * @private
   */
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
