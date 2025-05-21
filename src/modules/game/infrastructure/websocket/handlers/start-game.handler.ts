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
 * Servicio encargado de gestionar el inicio formal de una partida multijugador.
 *
 * Valida condiciones necesarias para comenzar:
 * - Autorización del creador
 * - Jugadores listos
 * - Equipos correctamente configurados (modo teams)
 *
 * Luego genera el tablero global, asigna equipos a barcos, establece el primer turno,
 * notifica a los jugadores y emite sus tableros personalizados.
 */
@Injectable()
export class StartGameHandler {
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
   * Ejecuta todo el flujo de inicio de partida:
   *
   * 1. Valida que la solicitud proviene del creador
   * 2. Asegura que todos estén listos
   * 3. Valida equipos (si aplica)
   * 4. Genera el tablero y lo persiste
   * 5. Establece el primer turno
   * 6. Notifica el inicio y envía tableros a cada jugador
   *
   * @param client Socket del creador
   * @param data Payload con el gameId a iniciar
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
      const game = await this.gameRepository.findByIdWithPlayers(gameId);
      if (!game) {
        this.logger.warn(`Partida no encontrada. gameId=${gameId}`);
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'Partida no encontrada',
        );
        return;
      }

      if (game.createdById !== userId) {
        this.logger.warn(`Intento de inicio no autorizado. userId=${userId}`);
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'Solo el creador puede iniciar la partida',
        );
        return;
      }

      const readySocketIds = await this.readyStateRedis.getAllReady(gameId);
      const allSocketIds = this.socketServerAdapter.getSocketsInGame(gameId);
      const allReady = allSocketIds.every((id) => readySocketIds.includes(id));

      if (!allReady) {
        this.logger.warn(`Jugadores no listos. gameId=${gameId}`);
        this.gameEventEmitter.emitGameStartAck(
          client.id,
          false,
          'No todos los jugadores están listos',
        );
        return;
      }

      const teams = await this.teamStateRedis.getAllTeams(gameId);

      // Validaciones específicas si el modo es por equipos
      if (game.mode === 'teams') {
        const userIds = game.gamePlayers.map((p) => p.userId);

        // Todos los jugadores deben tener equipo
        const allAssigned = userIds.every((id) => teams[id] !== undefined);
        if (!allAssigned) {
          this.logger.warn(`Faltan asignaciones de equipo. gameId=${gameId}`);
          this.gameEventEmitter.emitGameStartAck(
            client.id,
            false,
            'No todos los jugadores tienen equipo asignado',
          );
          return;
        }

        // Al menos un equipo debe tener 2 o más integrantes
        const teamCounts: Record<number, number> = {};
        Object.values(teams).forEach((teamId) => {
          teamCounts[teamId] = (teamCounts[teamId] || 0) + 1;
        });

        const validTeam = Object.values(teamCounts).some((count) => count >= 2);
        if (!validTeam) {
          this.logger.warn(
            `Distribución inválida: todos los equipos con 1 jugador. gameId=${gameId}`,
          );
          this.gameEventEmitter.emitGameStartAck(
            client.id,
            false,
            'Debe existir al menos un equipo con 2 o más jugadores',
          );
          return;
        }
      }

      // Generar tablero con barcos para todos los jugadores
      const playerIds = game.gamePlayers.map((p) => p.userId);
      const board = this.boardGenerationService.generateGlobalBoard(
        playerIds,
        game.difficulty as Difficulty,
        game.mode as Mode,
      );

      // Asignar equipos a barcos
      if (game.mode === 'teams') {
        board.ships.forEach((ship) => {
          if (ship.ownerId !== null && teams[ship.ownerId] !== undefined) {
            ship.teamId = teams[ship.ownerId];
          }
        });
      }

      await this.gameRepository.updateGameStartBoard(gameId, board);
      await this.turnStateRedis.setCurrentTurn(gameId, game.createdById);

      this.gameEventEmitter.emitTurnChanged(gameId, game.createdById);
      this.gameEventEmitter.emitGameStarted(gameId);
      this.gameEventEmitter.emitGameStartAck(client.id, true);

      this.logger.log(`Partida iniciada correctamente. gameId=${gameId}`);

      await this.sendInitialBoardState(allSocketIds, game.id);
    } catch (error) {
      this.logger.error(`Error al iniciar partida: gameId=${gameId}`, error);
      this.gameEventEmitter.emitGameStartAck(
        client.id,
        false,
        'Error al generar el tablero de juego',
      );
    }
  }

  /**
   * Envía el estado visual del tablero a todos los jugadores conectados.
   *
   * Cada jugador recibe su versión personalizada del tablero.
   *
   * @param socketIds Lista de sockets conectados en la partida
   * @param gameId ID de la partida
   * @returns Promesa que se resuelve cuando todos los estados han sido enviados
   * @private
   */
  private async sendInitialBoardState(
    socketIds: string[],
    gameId: number,
  ): Promise<void> {
    for (const socketId of socketIds) {
      const socket = this.socketServerAdapter
        .getServer()
        .sockets.sockets.get(socketId);

      if (socket) {
        await this.boardHandler.sendBoardUpdate(
          socket as SocketWithUser,
          gameId,
        );
        this.logger.debug(`Tablero enviado a socket ${socketId}`);
      } else {
        this.logger.warn(
          `Socket no encontrado para envío de tablero: ${socketId}`,
        );
      }
    }

    this.logger.log(`Tableros iniciales enviados a todos. gameId=${gameId}`);
  }
}
