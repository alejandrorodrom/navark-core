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
 * Servicio responsable de gestionar y distribuir actualizaciones del estado del tablero
 * a los clientes conectados al juego mediante WebSockets.
 *
 * El BoardHandler cumple una función crítica en el juego:
 * - Personaliza la vista del tablero según el jugador que la solicita
 * - Aplica las reglas de visibilidad de barcos según el modo de juego (individual/equipos)
 * - Entrega a cada cliente solo la información que debe conocer según su rol
 * - Mantiene sincronizados a todos los clientes con el estado más reciente del juego
 *
 * Este servicio sigue el principio de "necesidad de conocer" (need-to-know basis),
 * donde cada cliente recibe solo la información que necesita y está autorizado a ver.
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
   * Construye y envía a un cliente específico una visión personalizada del tablero actual.
   *
   * Esta función genera un paquete de datos con toda la información que un jugador
   * necesita para visualizar el estado del tablero de juego, incluyendo:
   *
   * 1. Dimensiones del tablero (tamaño de la cuadrícula)
   * 2. Ubicación y estado de sus propios barcos
   * 3. Ubicación de los barcos de sus compañeros de equipo (en modo equipo)
   * 4. Todos los disparos realizados en el tablero y sus resultados
   * 5. Estado detallado de daño de sus propios barcos
   *
   * La información se filtra para ocultar la posición de los barcos enemigos
   * que no han sido impactados, manteniendo el elemento estratégico del juego.
   *
   * @param client Socket del cliente que solicita la actualización, incluye datos de autenticación
   * @param gameId Identificador único de la partida que se está visualizando
   * @returns Promesa que se resuelve cuando se ha enviado la actualización al cliente
   */
  async sendBoardUpdate(client: SocketWithUser, gameId: number): Promise<void> {
    // Obtener datos actualizados de la partida desde la base de datos
    const game = await this.gameRepository.findByIdWithPlayersAndUsers(gameId);

    // Verificar que exista la partida y su tablero
    if (!game?.board) {
      this.logger.warn(`No se encontró tablero para gameId=${gameId}`);
      return;
    }

    // Procesar el tablero desde formato JSON almacenado a objeto de dominio
    const board = parseBoard(game.board);

    // Obtener la configuración actual de equipos para determinar aliados
    const teams = await this.teamStateRedis.getAllTeams(gameId);

    // Filtrar barcos visibles para este jugador específico según las reglas del juego
    // (propios + equipo, pero no los de enemigos)
    const ships = this.boardVisualizationService.getVisibleShips(
      board.ships,
      client.data.userId,
      teams,
      game.gamePlayers,
    );

    // Transformar todos los disparos realizados a formato visual para el cliente
    const shots = this.boardVisualizationService.getFormattedShots(
      board.shots || [],
    );

    // Obtener estado detallado de daño de los barcos que pertenecen a este jugador
    const myShips = this.boardVisualizationService.getMyShipsState(
      board.ships,
      client.data.userId,
    );

    // Preparar el payload tipado para la respuesta
    const payload: EventPayload<GameEvents.BOARD_UPDATE> = {
      board: {
        size: board.size,
        ships,
        shots,
        myShips,
      },
    };

    // Enviar la vista personalizada del tablero al cliente solicitante
    this.gameEventEmitter.emitBoardUpdate(client.data.userId, payload);

    this.logger.debug(
      `Tablero actualizado enviado a userId=${client.data.userId}, gameId=${gameId}`,
    );
  }
}
