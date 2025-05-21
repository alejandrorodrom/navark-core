import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { TurnStateRedis } from '../../redis/turn-state.redis';
import { NuclearStateRedis } from '../../redis/nuclear-state.redis';
import { TurnTimeoutManager } from '../../managers/turn-timeout.manager';
import { TurnOrchestrator } from '../../orchestrators/turn.orchestrator';
import { FireShotUseCase } from '../../../application/use-cases/fire-shot.use-case';
import { Shot, ShotType } from '../../../domain/models/shot.model';
import { BoardHandler } from './board.handler';
import { GameStatus } from '../../../../../prisma/prisma.enum';
import { GameRepository } from '../../../domain/repository/game.repository';
import { PlayerRepository } from '../../../domain/repository/player.repository';
import { parseBoard } from '../../../application/mapper/board.mapper';
import { GameEvents } from '../events/constants/game-events.enum';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { EventPayload } from '../events/types/events-payload.type';
import { Board } from '../../../domain/models/board.model';
import { TurnLogicUseCase } from '../../../application/use-cases/turn-logic.use-case';

/**
 * FireHandler gestiona todo el flujo de un disparo en la partida.
 * Se encarga de validar turnos, registrar disparos, actualizar tableros,
 * y controlar el progreso del arma nuclear y la eliminación de jugadores.
 */
@Injectable()
export class FireHandler {
  private readonly logger = new Logger(FireHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly turnTimeoutService: TurnTimeoutManager,
    private readonly turnOrchestratorService: TurnOrchestrator,
    private readonly shotService: FireShotUseCase,
    private readonly boardHandler: BoardHandler,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Controlador principal del evento de disparo de un jugador.
   *
   * Este método:
   * - Valida que la partida esté activa y que sea el turno del jugador.
   * - Evita disparos repetidos o inválidos (incluyendo disparos nucleares usados).
   * - Procesa el disparo y actualiza el tablero y el estado nuclear.
   * - Avanza el turno si el disparo fue válido.
   *
   * @param client Socket del jugador que disparó.
   * @param data Payload del evento PLAYER_FIRE.
   */
  async onPlayerFire(
    client: SocketWithUser,
    data: EventPayload<GameEvents.PLAYER_FIRE>,
  ): Promise<void> {
    const { gameId, x, y, shotType } = data;
    const userId = client.data.userId;
    const nickname = client.data.nickname || 'Jugador desconocido';

    this.logger.log(
      `Disparo recibido: gameId=${gameId}, jugador=${nickname} (userId=${userId}), coordenadas=(${x},${y}), tipo=${shotType}`,
    );

    try {
      // Paso 1: Validar existencia y estado de la partida
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'Partida no encontrada.',
        });
        return;
      }
      if (game.status !== GameStatus.in_progress) {
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'La partida no está en curso.',
        });
        return;
      }

      // Paso 2: Validar que sea el turno del jugador
      const currentTurnUserId =
        await this.turnStateRedis.getCurrentTurn(gameId);
      if (currentTurnUserId !== userId) {
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'No es tu turno para disparar.',
        });
        return;
      }

      // Paso 3: Validar y parsear tablero
      if (!game.board) {
        this.gameEventEmitter.emitError(
          client.id,
          'Error interno: Tablero no encontrado.',
          'BOARD_NOT_FOUND',
        );
        return;
      }
      const board = parseBoard(game.board);
      board.shots ??= [];

      // Paso 4: Verificar que no se repita un disparo
      const alreadyShot = board.shots.some(
        (shot) => shot.target.row === y && shot.target.col === x,
      );
      if (alreadyShot) {
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'Ya se ha disparado en esta posición anteriormente.',
        });
        return;
      }

      /**
       * Paso 4.1: Validar si ya usó la bomba nuclear (en caso aplique).
       *
       * Si el tipo de disparo es "nuclear", el jugador debe tener disponibilidad,
       * y no haberla usado previamente.
       */
      if (shotType === 'nuclear') {
        const [hasNuclear, hasUsed] = await Promise.all([
          this.nuclearStateRedis.hasNuclearAvailable(gameId, userId),
          this.nuclearStateRedis.hasNuclearUsed(gameId, userId),
        ]);

        if (!hasNuclear || hasUsed) {
          this.gameEventEmitter.emitPlayerFireAck(client.id, {
            success: false,
            error: 'No puedes usar la bomba nuclear.',
          });
          return;
        }
      }

      // Paso 5: Registrar el disparo usando la lógica central de disparo
      const result = await this.shotService.registerShot({
        gameId,
        shooterId: userId,
        type: shotType as ShotType,
        target: { row: y, col: x },
        board,
      });

      // Paso 6: Emitir evento PLAYER_FIRED
      this.gameEventEmitter.emitPlayerFired(gameId, {
        shooterUserId: userId,
        x,
        y,
        hit: result.shot.hit,
        sunk: !!result.shot.sunkShipId,
      });

      // Paso 7: Persistir tablero actualizado
      await this.gameRepository.updateGameBoard(gameId, result.updatedBoard);

      // Paso 8: Si impactó, evaluar si hay jugadores eliminados
      if (result.shot.hit) {
        await this.handleHitResult(result.updatedBoard, result.shot, gameId);
      }

      // Paso 9: Actualizar estado nuclear (progreso o reset)
      await this.handleNuclearProgress(
        gameId,
        userId,
        result.shot.hit,
        shotType as ShotType,
      );

      /**
       * Paso 9.1: Si el disparo fue de tipo nuclear, marcarlo como usado.
       *
       * Esto evita que el jugador vuelva a disparar con arma nuclear en esta partida.
       */
      if (shotType === 'nuclear') {
        await this.nuclearStateRedis.markNuclearUsed(gameId, userId);
      }

      // Paso 10: Enviar estado nuclear actualizado al jugador
      await this.sendNuclearStatus(gameId, client);

      // Paso 11: Confirmación ACK al disparador
      this.gameEventEmitter.emitPlayerFireAck(client.id, {
        success: true,
        hit: result.shot.hit,
        sunk: !!result.shot.sunkShipId,
      });

      // Paso 12: Enviar visualización del tablero
      await this.boardHandler.sendBoardUpdate(client, gameId);

      // Paso 13: Limpiar timeout de turno actual
      await this.turnTimeoutService.clear(gameId);

      // Paso 14: Avanzar turno
      await this.turnOrchestratorService.passTurn(gameId, userId);
    } catch (error) {
      this.logger.error(
        `Error al procesar disparo: gameId=${gameId}, userId=${userId}`,
        error,
      );
      this.gameEventEmitter.emitError(
        client.id,
        'Error interno al procesar el disparo.',
        'FIRE_PROCESSING_ERROR',
      );
    }
  }

  /**
   * Procesa consecuencias de un disparo exitoso, como eliminación del jugador afectado.
   *
   * @param updatedBoard Tablero actualizado
   * @param shot Disparo realizado
   * @param gameId ID de la partida
   * @private
   */
  private async handleHitResult(
    updatedBoard: Board,
    shot: Shot,
    gameId: number,
  ): Promise<void> {
    const ship = updatedBoard.ships.find((s) =>
      s.positions.some(
        (p) => p.row === shot.target.row && p.col === shot.target.col,
      ),
    );
    if (!ship || ship.ownerId == null) return;

    const stillAlive = TurnLogicUseCase.hasShipsAlive(
      updatedBoard,
      ship.ownerId,
    );

    if (!stillAlive) {
      await this.playerRepository.markPlayerAsDefeated(gameId, ship.ownerId);
      this.gameEventEmitter.emitPlayerEliminated(gameId, ship.ownerId);
    }
  }

  /**
   * Controla el progreso del sistema nuclear según disparo y tipo.
   *
   * @param gameId ID de la partida
   * @param userId ID del jugador que disparó
   * @param hit Si el disparo fue exitoso
   * @param shotType Tipo de disparo
   * @private
   */
  private async handleNuclearProgress(
    gameId: number,
    userId: number,
    hit: boolean,
    shotType: ShotType,
  ): Promise<void> {
    if (shotType !== 'simple') return;

    if (!hit) {
      await this.nuclearStateRedis.resetNuclearProgress(gameId, userId);
      return;
    }

    const progress = await this.nuclearStateRedis.incrementNuclearProgress(
      gameId,
      userId,
    );
    if (progress === 6) {
      await this.nuclearStateRedis.unlockNuclear(gameId, userId);
    }
  }

  /**
   * Envía el estado nuclear actual (progreso, disponibilidad y uso) al jugador.
   *
   * @param gameId ID de la partida
   * @param client Socket del jugador
   * @private
   */
  private async sendNuclearStatus(
    gameId: number,
    client: SocketWithUser,
  ): Promise<void> {
    try {
      const [progress, hasNuclear, used] = await Promise.all([
        this.nuclearStateRedis.getNuclearProgress(gameId, client.data.userId),
        this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
        this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
      ]);

      this.gameEventEmitter.emitNuclearStatus(
        gameId,
        progress,
        hasNuclear,
        used,
      );
    } catch {
      this.gameEventEmitter.emitError(
        client.id,
        'Error al actualizar estado nuclear',
        'NUCLEAR_STATUS_ERROR',
      );
    }
  }
}
