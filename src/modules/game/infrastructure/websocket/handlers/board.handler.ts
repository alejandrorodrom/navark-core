import { Injectable, Logger } from '@nestjs/common';
import { TeamStateRedis } from '../../redis/team-state.redis';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { BoardVisualizationUseCase } from '../../../application/use-cases/board-visualization.use-case';
import { GameRepository } from '../../../domain/repository/game.repository';
import { parseBoard } from '../../../application/mapper/board.mapper';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { GameEvents } from '../events/constants/game-events.enum';
import { EventPayload } from '../events/types/events-payload.type';

/**
 * Servicio encargado de construir y emitir una versión personalizada del tablero
 * a cada cliente que lo solicite.
 *
 * Este handler se asegura de:
 * - Consultar el estado actual del juego y el tablero desde la base de datos.
 * - Aplicar reglas de visibilidad por jugador.
 * - Transformar los datos del tablero a una estructura visual amigable para el cliente.
 * - Emitir al cliente el evento `BOARD_UPDATE` con su vista personalizada.
 */
@Injectable()
export class BoardHandler {
  private readonly logger = new Logger(BoardHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly gameEventEmitter: GameEventEmitter,
    private readonly boardVisualizationService: BoardVisualizationUseCase,
  ) {}

  /**
   * Genera y envía una vista personalizada del tablero al jugador conectado.
   *
   * Este método se invoca típicamente:
   * - Cuando un jugador se une a una partida.
   * - Después de reconectarse.
   * - Tras un disparo que cambia el estado del tablero.
   *
   * @param client Socket del jugador autenticado que recibirá la actualización.
   * @param gameId ID de la partida a la que pertenece el tablero.
   * @returns Promesa que se resuelve cuando se emite el evento `BOARD_UPDATE`.
   */
  async sendBoardUpdate(client: SocketWithUser, gameId: number): Promise<void> {
    // Paso 1: Obtener el estado actualizado de la partida
    const game = await this.gameRepository.findByIdWithPlayersAndUsers(gameId);

    if (!game?.board) {
      this.logger.warn(`No se encontró tablero para gameId=${gameId}`);
      return;
    }

    // Paso 2: Parsear el tablero desde el JSON persistido
    const board = parseBoard(game.board);

    // Paso 3: Obtener configuración de equipos desde Redis
    const teams = await this.teamStateRedis.getAllTeams(gameId);

    // Paso 4: Determinar qué barcos debe ver este jugador
    const ships = this.boardVisualizationService.getVisibleShips(
      board.ships,
      client.data.userId,
      teams,
      game.gamePlayers,
    );

    // Paso 5: Transformar disparos a estructura visual (`row`, `col`, `hit`)
    const shots = this.boardVisualizationService.getFormattedShots(
      board.shots || [],
    );

    // Paso 6: Obtener estado detallado de daño de los barcos propios
    const myShips = this.boardVisualizationService.getMyShipsState(
      board.ships,
      client.data.userId,
    );

    // Paso 7: Construir el payload a emitir
    const payload: EventPayload<GameEvents.BOARD_UPDATE> = {
      board: {
        size: board.size,
        ships,
        shots,
        myShips,
      },
    };

    // Paso 8: Emitir el evento al jugador autenticado
    this.gameEventEmitter.emitBoardUpdate(client.data.userId, payload);

    this.logger.debug(
      `Tablero actualizado enviado a userId=${client.data.userId}, gameId=${gameId}`,
    );
  }
}
