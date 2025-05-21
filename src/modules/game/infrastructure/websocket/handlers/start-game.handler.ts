import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { ReadyStateRedis } from '../../redis/ready-state.redis';
import { TeamStateRedis } from '../../redis/team-state.redis';
import { TurnStateRedis } from '../../redis/turn-state.redis';
import { BoardGenerationUseCase } from '../../../application/use-cases/board-generation.use-case';
import { BoardHandler } from './board.handler';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { GameEvents } from '../events/constants/game-events.enum';
import { Difficulty, Mode } from '../../../domain/models/board.model';
import { EventPayload } from '../events/types/events-payload.type';

/**
 * Servicio especializado en el manejo del inicio de partidas, encargado de:
 *
 * - Validar que todos los participantes cumplan requisitos para comenzar
 * - Verificar configuraciones de equipos según el modo de juego
 * - Coordinar la generación del tablero global con barcos para todos los jugadores
 * - Asignar equipos a los barcos cuando corresponda
 * - Inicializar estado de turno y notificar a los participantes
 * - Enviar estados iniciales del tablero a cada jugador
 *
 * Este servicio representa el punto crítico de transición entre la fase de
 * preparación de una partida y el inicio efectivo del juego.
 */
@Injectable()
export class StartGameHandler {
  /** Logger dedicado para monitorear el proceso de inicio de partidas */
  private readonly logger = new Logger(StartGameHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly readyStateRedis: ReadyStateRedis,
    private readonly teamStateRedis: TeamStateRedis,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly boardGenerationService: BoardGenerationUseCase,
    private readonly boardHandler: BoardHandler,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Procesa la solicitud de inicio de partida verificando:
   *
   * 1. Que la solicitud provenga del creador de la partida
   * 2. Que todos los jugadores estén preparados (estado "ready")
   * 3. Que en modo equipos, cada jugador tenga un equipo asignado
   * 4. Que al menos un equipo tenga suficientes jugadores (≥2)
   *
   * Si todas las validaciones son exitosas, genera el tablero global,
   * asigna equipos a los barcos cuando corresponde, establece el turno inicial
   * y notifica a todos los participantes que el juego ha comenzado.
   *
   * @param client Socket del cliente que solicita iniciar la partida
   * @param data Objeto con el ID de la partida a iniciar
   * @returns Promesa que se resuelve cuando el proceso ha sido completado
   */
  async onGameStart(
    client: SocketWithUser,
    data: EventPayload<GameEvents.GAME_START>,
  ): Promise<void> {
    const gameId = data.gameId;
    const userId = client.data.userId;

    this.logger.log(
      `Solicitud de inicio recibida. gameId=${gameId}, socketId=${client.id}, userId=${userId}`,
    );

    try {
      // Obtener información de la partida con sus jugadores
      const game = await this.gameRepository.findByIdWithPlayers(gameId);

      // Validar que la partida exista
      if (!game) {
        this.logger.warn(`Partida no encontrada. gameId=${gameId}`);
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'Partida no encontrada',
        );
        return;
      }

      // Validar que la solicitud provenga del creador
      if (game.createdById?.toString() !== userId?.toString()) {
        this.logger.warn(
          `Usuario no autorizado. userId=${userId}, gameId=${gameId}`,
        );
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'Solo el creador puede iniciar la partida',
        );
        return;
      }

      // Obtener información de estado de jugadores listos
      const readySocketIds = await this.readyStateRedis.getAllReady(gameId);
      const allSocketIds = this.socketServerAdapter.getSocketsInGame(gameId);

      // Validar que todos los jugadores estén listos
      const allPlayersReady = allSocketIds.every((id) =>
        readySocketIds.includes(id),
      );

      if (!allPlayersReady) {
        this.logger.warn(`Jugadores no listos. gameId=${gameId}`);
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'No todos los jugadores están listos',
        );
        return;
      }

      // Obtener asignaciones de equipos
      const teams = await this.teamStateRedis.getAllTeams(gameId);

      // Validar asignación de equipos según el modo de juego
      if (game.mode === 'teams') {
        // Verificar que todos los jugadores tengan equipo asignado
        const allPlayersAssignedTeam = allSocketIds.every((id) => teams[id]);

        if (!allPlayersAssignedTeam) {
          this.logger.warn(`Jugadores sin equipo asignado. gameId=${gameId}`);
          this.gameEventEmitter.emitGameStartAck(
            client.id,
            false,
            'No todos los jugadores tienen equipo asignado',
          );
          return;
        }

        // Verificar que al menos un equipo tenga suficientes jugadores
        const playerTeamCounts: Record<number, number> = {};
        for (const team of Object.values(teams)) {
          playerTeamCounts[team] = (playerTeamCounts[team] || 0) + 1;
        }

        const hasTeamWithTwoOrMore = Object.values(playerTeamCounts).some(
          (count) => count >= 2,
        );

        if (!hasTeamWithTwoOrMore) {
          this.logger.warn(
            `No hay equipos con al menos 2 jugadores. gameId=${gameId}`,
          );
          this.gameEventEmitter.emitGameStartAck(
            client.id,
            false,
            'Debe existir al menos un equipo con 2 o más jugadores',
          );
          return;
        }
      }

      // Generar tablero global con barcos para todos los jugadores
      const playerIds = game.gamePlayers.map((player) => player.userId);

      const board = this.boardGenerationService.generateGlobalBoard(
        playerIds,
        game.difficulty as Difficulty,
        game.mode as Mode,
      );

      // Asignar teamId a barcos si es modo equipos
      if (game.mode === 'teams') {
        // Crear un mapa de userId -> teamId para búsqueda eficiente
        const userTeamMap = new Map<number, number>();

        // Llenar el mapa primero
        for (const socketId of Object.keys(teams)) {
          // Buscar el jugador asociado a este socketId
          const player = game.gamePlayers.find(
            (p) => p.userId.toString() === socketId,
          );
          if (player) {
            userTeamMap.set(player.userId, teams[socketId]);
          }
        }

        // Asignar equipos a los barcos
        for (const ship of board.ships) {
          // Asegurarnos de que ownerId no sea null antes de usarlo
          if (ship.ownerId !== null && ship.ownerId !== undefined) {
            const teamId = userTeamMap.get(ship.ownerId);
            if (teamId) {
              ship.teamId = teamId;
            }
          }
        }
      }

      // Persistir el tablero generado y actualizar estado de la partida
      await this.gameRepository.updateGameStartBoard(gameId, board);

      // Establecer el turno inicial (siempre empieza el creador)
      await this.turnStateRedis.setCurrentTurn(game.id, game.createdById);

      // Notificar a todos los jugadores que la partida ha comenzado
      this.gameEventEmitter.emitTurnChanged(gameId, game.createdById);
      this.gameEventEmitter.emitGameStarted(gameId);

      // Confirmar al creador que el inicio fue exitoso
      this.gameEventEmitter.emitGameStartAck(client.id, true);

      this.logger.log(`Partida iniciada exitosamente. gameId=${gameId}`);

      // Enviar a cada jugador su vista personalizada del tablero
      await this.sendInitialBoardState(allSocketIds, game.id);
    } catch (error) {
      this.logger.error(
        `Error al iniciar partida: gameId=${gameId}, error=${error}`,
      );
      this.gameEventEmitter.emitGameStartAck(
        client.id,
        false,
        'Error al generar el tablero de juego',
      );
    }
  }

  /**
   * Envía a cada jugador su vista personalizada del tablero con la
   * información visible según su rol y equipo.
   *
   * @param socketIds Lista de IDs de socket de los jugadores
   * @param gameId ID de la partida
   * @returns Promesa que se resuelve cuando todos los estados han sido enviados
   * @private
   */
  private async sendInitialBoardState(
    socketIds: string[],
    gameId: number,
  ): Promise<void> {
    try {
      for (const socketId of socketIds) {
        const socket = this.socketServerAdapter
          .getServer()
          .sockets.sockets.get(socketId);

        if (socket) {
          await this.boardHandler.sendBoardUpdate(
            socket as SocketWithUser,
            gameId,
          );
          this.logger.debug(`Tablero enviado para socket ${socketId}`);
        } else {
          this.logger.warn(
            `Socket no encontrado al enviar tablero: ${socketId}`,
          );
        }
      }

      this.logger.log(
        `Estados iniciales de tablero enviados a todos los jugadores para gameId=${gameId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar estados iniciales del tablero: gameId=${gameId}, error=${error}`,
      );
    }
  }
}
