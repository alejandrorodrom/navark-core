import { Injectable, Logger } from '@nestjs/common';
import { Board } from '../../../../domain/models/board.model';
import {
  Shot,
  ShotType,
  ShotTarget,
} from '../../../../domain/models/shot.model';
import { ShotRepository } from '../../../../domain/repository/shot.repository';
import { ShotEvaluatorService } from '../../../../domain/services/shot/shot-evaluator.service';
import { TeamStateRedis } from '../../../redis/team-state.redis';
import { Ship } from '../../../../domain/models/ship.model';

/**
 * ShotService se encarga de orquestar disparos y registrarlos.
 * Incluye lógica especializada para manejar diferentes tipos de disparos
 * con sus respectivos patrones de área de impacto.
 */
@Injectable()
export class ShotService {
  private readonly logger = new Logger(ShotService.name);

  constructor(
    private readonly shotRepository: ShotRepository,
    private readonly teamStateRedis: TeamStateRedis,
  ) {}

  /**
   * Procesa y registra un disparo en la base de datos.
   * Para tipos especiales de disparo, genera múltiples coordenadas de impacto.
   *
   * @param params Datos del disparo y tablero.
   * @returns Disparo registrado y tablero actualizado.
   */
  async registerShot(params: {
    gameId: number;
    shooterId: number;
    type: ShotType;
    target: ShotTarget;
    board: Board;
  }): Promise<{
    shot: Shot;
    updatedBoard: Board;
  }> {
    const { gameId, shooterId, type, target, board } = params;

    // Obtener equipos para verificar si un barco es aliado
    const teams = await this.teamStateRedis.getAllTeams(gameId);

    // Generar todas las coordenadas objetivo según el tipo de disparo
    const targets: ShotTarget[] = this.generateTargetsForShotType(
      type,
      target,
      board.size,
    );
    this.logger.debug(
      `Generadas ${targets.length} coordenadas para disparo tipo ${type}`,
    );

    // El disparo principal (el que registramos en la BD)
    let primaryShot: Shot | null = null;

    // Lista de objetivos válidos después de filtrar
    const validTargets: ShotTarget[] = [];

    // Primera pasada: filtrar objetivos inválidos
    for (const currentTarget of targets) {
      // Verificar si este objetivo ya fue disparado anteriormente
      const alreadyShot = board.shots?.some(
        (shot) =>
          shot.target.row === currentTarget.row &&
          shot.target.col === currentTarget.col,
      );

      if (alreadyShot) {
        this.logger.debug(
          `Objetivo (${currentTarget.row},${currentTarget.col}) ya disparado, saltando.`,
        );
        continue;
      }

      // Verificar si hay un barco aliado en esta posición
      const isAlliedShip = this.isAlliedShipPosition(
        board.ships,
        currentTarget.row,
        currentTarget.col,
        shooterId,
        this.convertTeamsFormat(teams),
      );

      if (isAlliedShip) {
        this.logger.debug(
          `Objetivo (${currentTarget.row},${currentTarget.col}) contiene barco aliado, saltando.`,
        );
        continue;
      }

      // Si llegamos aquí, el objetivo es válido
      validTargets.push(currentTarget);
    }

    // Si no hay objetivos válidos, usar solo el objetivo principal
    if (validTargets.length === 0) {
      this.logger.warn(
        `No hay objetivos válidos para el disparo tipo ${type}, usando solo el principal.`,
      );
      validTargets.push(target);
    }

    // Segunda pasada: procesar cada objetivo válido
    for (const currentTarget of validTargets) {
      // Evaluar el impacto en esta coordenada
      const result = ShotEvaluatorService.evaluate(
        board.ships,
        currentTarget.row,
        currentTarget.col,
      );

      // Solo registramos en BD el disparo principal (coordenada original)
      if (
        currentTarget.row === target.row &&
        currentTarget.col === target.col
      ) {
        const createdShot = await this.shotRepository.registerShot(
          gameId,
          shooterId,
          type,
          currentTarget,
          result.hit,
        );

        primaryShot = {
          id: createdShot.id,
          gameId: createdShot.gameId,
          shooterId: createdShot.shooterId,
          type: createdShot.type as ShotType,
          target: createdShot.target as ShotTarget,
          hit: createdShot.hit,
          sunkShipId: result.sunkShipId,
          createdAt: createdShot.createdAt.toISOString(),
        };
      }

      // Agregamos el disparo al tablero para mantener el registro visual
      if (!board.shots) {
        board.shots = [];
      }

      const shotToAdd: Shot = primaryShot
        ? { ...primaryShot }
        : {
            id: -1, // ID temporal para disparos secundarios (no guardados en BD)
            gameId,
            shooterId,
            type,
            target: currentTarget,
            hit: result.hit,
            sunkShipId: result.sunkShipId,
            createdAt: new Date().toISOString(),
          };

      // Actualizar coordenadas para este disparo específico
      shotToAdd.target = currentTarget;
      shotToAdd.hit = result.hit;
      shotToAdd.sunkShipId = result.sunkShipId;

      board.shots.push(shotToAdd);
    }

    // Si no se pudo registrar el disparo principal, algo salió mal
    if (!primaryShot) {
      this.logger.error('No se pudo registrar el disparo principal');
      throw new Error('Error al registrar el disparo principal');
    }

    return {
      shot: primaryShot,
      updatedBoard: board,
    };
  }

  /**
   * Verifica si una posición contiene un barco aliado (propio o de un compañero de equipo).
   *
   * @param ships Lista de barcos en el tablero
   * @param row Fila a verificar
   * @param col Columna a verificar
   * @param shooterId ID del jugador que dispara
   * @param teams Mapa de equipos en la partida
   * @returns true si hay un barco aliado en esa posición
   */
  private isAlliedShipPosition(
    ships: Ship[],
    row: number,
    col: number,
    shooterId: number,
    teams: Map<number, number[]>,
  ): boolean {
    // Obtener el equipo del jugador que dispara
    const shooterTeam = this.getPlayerTeam(shooterId, teams);

    // Buscar un barco en esa posición
    for (const ship of ships) {
      for (const pos of ship.positions) {
        if (pos.row === row && pos.col === col) {
          // Si el barco es propio, es aliado
          if (ship.ownerId === shooterId) {
            return true;
          }

          // Si el barco pertenece a un compañero de equipo, es aliado
          if (shooterTeam && ship.ownerId) {
            const shipOwnerTeam = this.getPlayerTeam(ship.ownerId, teams);
            if (shipOwnerTeam === shooterTeam) {
              return true;
            }
          }

          // El barco existe pero es enemigo
          return false;
        }
      }
    }

    // No hay barco en esta posición
    return false;
  }

  /**
   * Obtiene el equipo al que pertenece un jugador.
   *
   * @param userId ID del jugador
   * @param teams Mapa de equipos en la partida
   * @returns ID del equipo o null si no tiene equipo
   */
  private getPlayerTeam(
    userId: number,
    teams: Map<number, number[]>,
  ): number | null {
    for (const [teamId, members] of teams.entries()) {
      if (members.includes(userId)) {
        return teamId;
      }
    }
    return null;
  }

  /**
   * Genera un conjunto de coordenadas objetivo basado en el tipo de disparo.
   * Cada tipo de disparo tiene un patrón específico:
   *
   * - simple: Solo la coordenada indicada
   * - cross: Forma una cruz (+) - 5 casillas
   * - multi: Disparo en 3 coordenadas aleatorias
   * - area: Área cuadrada 2x2
   * - nuclear: Área en forma de rombo 6x6
   *
   * @param type Tipo de disparo
   * @param target Coordenada central del disparo
   * @param boardSize Tamaño del tablero para validar límites
   * @returns Array de coordenadas objetivo
   */
  private generateTargetsForShotType(
    type: ShotType,
    target: ShotTarget,
    boardSize: number,
  ): ShotTarget[] {
    const targets: ShotTarget[] = [];
    const { row, col } = target;

    // Validar que las coordenadas estén dentro del tablero
    const isValidCoordinate = (r: number, c: number): boolean => {
      return r >= 0 && r < boardSize && c >= 0 && c < boardSize;
    };

    switch (type) {
      case 'simple': {
        // Disparo simple: solo afecta la coordenada indicada
        if (isValidCoordinate(row, col)) {
          targets.push({ row, col });
        }
        break;
      }

      case 'cross': {
        // Disparo en cruz: afecta 5 casillas en forma de cruz
        const crossOffsets = [
          [0, 0], // Centro
          [0, 1], // Derecha
          [0, -1], // Izquierda
          [1, 0], // Abajo
          [-1, 0], // Arriba
        ];

        for (const [rowOffset, colOffset] of crossOffsets) {
          const newRow = row + rowOffset;
          const newCol = col + colOffset;

          if (isValidCoordinate(newRow, newCol)) {
            targets.push({ row: newRow, col: newCol });
          }
        }
        break;
      }

      case 'multi': {
        // Disparo múltiple: 3 coordenadas (la central más dos aleatorias cercanas)
        targets.push({ row, col }); // Siempre incluir la coordenada central

        // Generar hasta 2 coordenadas aleatorias adicionales
        const maxAttempts = 10; // Límite de intentos para encontrar coordenadas válidas
        const randomOffsets: Array<[number, number]> = []; // Tipado correcto para el array de offsets

        for (
          let attempt = 0;
          attempt < maxAttempts && randomOffsets.length < 2;
          attempt++
        ) {
          // Generar offset aleatorio entre -2 y 2
          const rowOffset = Math.floor(Math.random() * 5) - 2;
          const colOffset = Math.floor(Math.random() * 5) - 2;

          // Evitar la coordenada central (ya incluida)
          if (rowOffset === 0 && colOffset === 0) continue;

          const newRow = row + rowOffset;
          const newCol = col + colOffset;

          // Verificar que sea una coordenada válida y no duplicada
          if (
            isValidCoordinate(newRow, newCol) &&
            !randomOffsets.some(([r, c]) => r === rowOffset && c === colOffset)
          ) {
            randomOffsets.push([rowOffset, colOffset]);
            targets.push({ row: newRow, col: newCol });
          }
        }
        break;
      }

      case 'area': {
        // Disparo de área: cuadrado 2x2 desde la coordenada indicada
        for (let rowOffset = 0; rowOffset < 2; rowOffset++) {
          for (let colOffset = 0; colOffset < 2; colOffset++) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;

            if (isValidCoordinate(newRow, newCol)) {
              targets.push({ row: newRow, col: newCol });
            }
          }
        }
        break;
      }

      case 'nuclear': {
        // Disparo nuclear: afecta un área en forma de rombo con radio 3 (6x6)
        // El radio determina la distancia máxima desde el centro
        const radius = 3;

        // Generar todas las posiciones dentro del radio (patrón de rombo)
        for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
          // Calcular el ancho de la "fila" actual en el rombo
          // Más estrecho en los extremos, más ancho en el centro
          const maxColOffset = radius - Math.abs(rowOffset);

          for (
            let colOffset = -maxColOffset;
            colOffset <= maxColOffset;
            colOffset++
          ) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;

            if (isValidCoordinate(newRow, newCol)) {
              targets.push({ row: newRow, col: newCol });
            }
          }
        }
        break;
      }

      default:
        // Tipo desconocido, solo usar la coordenada principal
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        this.logger.warn(`Tipo de disparo desconocido: ${type}, usando simple`);
        targets.push({ row, col });
        break;
    }

    this.logger.debug(
      `Tipo ${type}: Generadas ${targets.length} coordenadas para disparo en (${row},${col})`,
    );

    return targets;
  }

  /**
   * Convierte el formato de equipos de Redis (Record<string, number>)
   * al formato esperado por las funciones de utilidad (Map<number, number[]>).
   *
   * @param teamsRecord Formato original de Redis: clave=socketId, valor=teamId
   * @returns Formato esperado por las utilidades: clave=teamId, valor=array de userIds
   */
  private convertTeamsFormat(
    teamsRecord: Record<string, number>,
  ): Map<number, number[]> {
    // Crear un mapa para organizar usuarios por equipo
    const teamsMap = new Map<number, number[]>();

    // Recorrer el objeto original
    for (const [key, teamId] of Object.entries(teamsRecord)) {
      // Extraer el userId de la clave (asumiendo que las claves tienen formato 'socketId-userId')
      let userId: number | null = null;

      // Intentar extraer userId basado en el formato esperado
      const parts = key.split('-');
      if (parts.length > 1) {
        // Si la clave tiene formato 'socketId-userId'
        userId = parseInt(parts[parts.length - 1]);
      } else if (!isNaN(parseInt(key))) {
        // Si la clave es directamente un userId
        userId = parseInt(key);
      }

      // Si obtuvimos un userId válido
      if (userId !== null && !isNaN(userId)) {
        // Si el equipo no existe en el mapa, crearlo
        if (!teamsMap.has(teamId)) {
          teamsMap.set(teamId, []);
        }

        // Obtener array actual de usuarios en este equipo
        const usersInTeam = teamsMap.get(teamId) || [];

        // Agregar usuario si no está ya incluido
        if (!usersInTeam.includes(userId)) {
          usersInTeam.push(userId);
          teamsMap.set(teamId, usersInTeam);
        }
      }
    }

    return teamsMap;
  }
}
