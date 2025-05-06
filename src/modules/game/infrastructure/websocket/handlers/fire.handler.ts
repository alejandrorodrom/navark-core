import { Injectable, Logger } from '@nestjs/common';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { TurnStateRedis } from '../../redis/turn-state.redis';
import { NuclearStateRedis } from '../../redis/nuclear-state.redis';
import { TurnTimeoutService } from '../../services/game/turn/turn-timeout.service';
import { TurnOrchestratorService } from '../../services/game/turn/turn-orchestrator.service';
import { ShotService } from '../../services/game/fire/shot.service';
import { Shot, ShotType } from '../../../domain/models/shot.model';
import { BoardHandler } from './board.handler';
import { GameStatus } from '../../../../../prisma/prisma.enum';
import { GameRepository } from '../../../domain/repository/game.repository';
import { PlayerRepository } from '../../../domain/repository/player.repository';
import { parseBoard } from '../../mappers/board.mapper';
import { GameEvents } from '../events/constants/game-events.enum';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';
import { EventPayload } from '../events/types/events-payload.type';
import { Board } from '../../../domain/models/board.model';

/**
 * Gestor especializado en procesar acciones de disparo durante una partida de batalla naval.
 *
 * Este componente crítico implementa la mecánica principal del juego y coordina:
 * - Validaciones de turno y estado del juego
 * - Registro y procesamiento de disparos
 * - Actualización del tablero global
 * - Detección de barcos hundidos y jugadores eliminados
 * - Progresión del sistema de armas nucleares
 * - Gestión del flujo de turnos
 *
 * Toda la lógica fundamental del juego relacionada con disparos
 * está encapsulada en este controlador, manteniendo la coherencia
 * del estado de juego y aplicando las reglas de negocio.
 */
@Injectable()
export class FireHandler {
  private readonly logger = new Logger(FireHandler.name);

  constructor(
    private readonly gameRepository: GameRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly turnTimeoutService: TurnTimeoutService,
    private readonly turnOrchestratorService: TurnOrchestratorService,
    private readonly shotService: ShotService,
    private readonly boardHandler: BoardHandler,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Procesa un disparo realizado por un jugador, validando todas las reglas del juego
   * y actualizando el estado de la partida.
   *
   * El proceso incluye:
   * 1. Validar que la partida esté en curso y sea el turno del jugador
   * 2. Comprobar que no sea un disparo repetido en las mismas coordenadas
   * 3. Registrar el disparo y actualizar el estado del tablero
   * 4. Verificar si algún barco fue hundido y si algún jugador fue eliminado
   * 5. Actualizar el progreso nuclear del jugador según el resultado
   * 6. Pasar el turno al siguiente jugador activo
   *
   * @param client Socket del cliente que realiza el disparo
   * @param data Datos del disparo incluyendo coordenadas y tipo
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
      // Obtener y validar el estado de la partida
      const game = await this.gameRepository.findById(gameId);

      if (!game) {
        this.logger.warn(
          `Disparo rechazado: Partida gameId=${gameId} no encontrada`,
        );
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'Partida no encontrada.',
        });
        return;
      }

      if (game.status !== GameStatus.in_progress) {
        this.logger.warn(
          `Disparo rechazado: Partida gameId=${gameId} en estado inválido (${game.status})`,
        );
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'La partida no está en curso.',
        });
        return;
      }

      // Validar que sea el turno del jugador
      const currentTurnUserId =
        await this.turnStateRedis.getCurrentTurn(gameId);
      if (currentTurnUserId !== userId) {
        this.logger.warn(
          `Disparo fuera de turno: gameId=${gameId}, disparador=${userId}, turno actual=${currentTurnUserId}`,
        );
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'No es tu turno para disparar.',
        });
        return;
      }

      // Validar que el tablero exista
      if (!game.board) {
        this.logger.error(
          `Error crítico: Partida gameId=${gameId} sin tablero inicializado`,
        );
        this.gameEventEmitter.emitError(
          client.id,
          'Error interno: Tablero no encontrado.',
          'BOARD_NOT_FOUND',
        );
        return;
      }

      // Obtener y preparar el tablero
      const board = parseBoard(game.board);
      if (!board.shots) {
        board.shots = [];
      }

      // Validar que no sea un disparo repetido
      const alreadyShot = board.shots.some(
        (shot) => shot.target.row === y && shot.target.col === x,
      );

      if (alreadyShot) {
        this.logger.warn(
          `Disparo repetido bloqueado: gameId=${gameId}, jugador=${nickname}, coordenadas=(${x},${y})`,
        );
        this.gameEventEmitter.emitPlayerFireAck(client.id, {
          success: false,
          error: 'Ya se ha disparado en esta posición anteriormente.',
        });
        return;
      }

      // Registrar el disparo y procesar el resultado
      this.logger.debug(
        `Procesando disparo en gameId=${gameId}: jugador=${nickname}, coordenadas=(${x},${y}), tipo=${shotType}`,
      );

      const result = await this.shotService.registerShot({
        gameId,
        shooterId: userId,
        type: shotType as ShotType,
        target: { row: y, col: x },
        board,
      });

      const hitMessage = result.shot.hit ? 'impactó' : 'falló';
      const sunkMessage = result.shot.sunkShipId
        ? ` y hundió barco ID=${result.shot.sunkShipId}`
        : '';

      this.logger.log(
        `Resultado disparo: gameId=${gameId}, jugador=${nickname}, coordenadas=(${x},${y}), ${hitMessage}${sunkMessage}`,
      );

      // Notificar a todos los jugadores sobre el disparo
      this.gameEventEmitter.emitPlayerFired(gameId, {
        shooterUserId: userId,
        x,
        y,
        hit: result.shot.hit,
        sunk: result.shot.sunkShipId !== undefined,
      });

      // Actualizar el tablero en la base de datos
      await this.gameRepository.updateGameBoard(gameId, result.updatedBoard);
      this.logger.debug(`Tablero actualizado en BD para gameId=${gameId}`);

      // Procesar el impacto si hubo uno
      if (result.shot.hit) {
        await this.handleHitResult(result.updatedBoard, result.shot, gameId);
      }

      // Actualizar progreso nuclear del jugador
      await this.handleNuclearProgress(
        gameId,
        userId,
        result.shot.hit,
        shotType as ShotType,
      );

      // Enviar estado nuclear actualizado al jugador
      await this.sendNuclearStatus(gameId, client);

      // Confirmar disparo al jugador que disparó
      this.gameEventEmitter.emitPlayerFireAck(client.id, {
        success: true,
        hit: result.shot.hit,
        sunk: result.shot.sunkShipId !== undefined,
      });

      // Enviar actualización del tablero a todos los jugadores
      await this.boardHandler.sendBoardUpdate(client, gameId);

      // Limpiar cualquier timeout pendiente y pasar al siguiente turno
      await this.turnTimeoutService.clear(gameId);

      this.logger.debug(
        `Pasando turno en gameId=${gameId} desde userId=${userId}`,
      );
      await this.turnOrchestratorService.passTurn(gameId, userId);
    } catch (error) {
      this.logger.error(
        `Error procesando disparo en gameId=${gameId}, jugador=${nickname}`,
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
   * Procesa el resultado de un disparo exitoso, verificando si el jugador atacado
   * ha perdido todos sus barcos y debe ser eliminado del juego.
   *
   * @param updatedBoard Tablero actualizado después del disparo
   * @param shot Información del disparo realizado
   * @param gameId ID de la partida
   * @private
   */
  private async handleHitResult(
    updatedBoard: Board,
    shot: Shot,
    gameId: number,
  ): Promise<void> {
    try {
      // Buscar el barco impactado
      const hitShip = updatedBoard.ships.find((ship) =>
        ship.positions.some(
          (p) => p.row === shot.target.row && p.col === shot.target.col,
        ),
      );

      if (!hitShip) {
        this.logger.warn(
          `Inconsistencia: No se encontró barco impactado en (${shot.target.row},${shot.target.col})`,
        );
        return;
      }

      const hitShipOwnerId = hitShip.ownerId;

      if (hitShipOwnerId === null || hitShipOwnerId === undefined) {
        this.logger.warn(
          `Barco sin propietario encontrado, ID=${hitShip.shipId}`,
        );
        return;
      }

      // Verificar si el propietario del barco perdió todos sus barcos
      const playerStillAlive = updatedBoard.ships.some(
        (ship) => ship.ownerId === hitShipOwnerId && !ship.isSunk,
      );

      // Si el jugador no tiene más barcos, marcarlo como eliminado
      if (!playerStillAlive) {
        this.logger.log(
          `Eliminando jugador userId=${hitShipOwnerId} en gameId=${gameId} por perder todos sus barcos`,
        );

        await this.playerRepository.markPlayerAsDefeated(
          gameId,
          hitShipOwnerId,
        );

        this.gameEventEmitter.emitPlayerEliminated(gameId, hitShipOwnerId);
      }
    } catch (error) {
      this.logger.error(`Error al procesar resultado de impacto: ${error}`);
    }
  }

  /**
   * Gestiona la actualización del progreso nuclear del jugador basado en el resultado del disparo.
   *
   * Reglas:
   * - Solo disparos simples incrementan el progreso nuclear
   * - Los impactos aumentan el contador, los fallos lo reinician
   * - Al alcanzar 6 impactos consecutivos, se desbloquea el armamento nuclear
   *
   * @param gameId ID de la partida
   * @param userId ID del usuario que realizó el disparo
   * @param hit Indica si el disparo impactó un barco
   * @param shotType Tipo de disparo realizado
   * @private
   */
  private async handleNuclearProgress(
    gameId: number,
    userId: number,
    hit: boolean,
    shotType: ShotType,
  ): Promise<void> {
    // Solo los disparos simples afectan al progreso nuclear
    if (shotType !== 'simple') {
      this.logger.debug(
        `Sin cambios en progreso nuclear: Disparo tipo=${shotType} no califica. gameId=${gameId}, userId=${userId}`,
      );
      return;
    }

    // Fallar un disparo reinicia el progreso nuclear
    if (!hit) {
      this.logger.debug(
        `Reseteando progreso nuclear por fallo: gameId=${gameId}, userId=${userId}`,
      );
      await this.nuclearStateRedis.resetNuclearProgress(gameId, userId);
      return;
    }

    // Incrementar el progreso nuclear por cada impacto
    const progress = await this.nuclearStateRedis.incrementNuclearProgress(
      gameId,
      userId,
    );

    this.logger.debug(
      `Progreso nuclear actualizado: gameId=${gameId}, userId=${userId}, nuevo progreso=${progress}/6`,
    );

    // Al alcanzar 6 impactos consecutivos, desbloquear el armamento nuclear
    if (progress === 6) {
      await this.nuclearStateRedis.unlockNuclear(gameId, userId);
      this.logger.log(
        `¡Arma nuclear desbloqueada! gameId=${gameId}, userId=${userId}`,
      );
    }
  }

  /**
   * Envía el estado actual de progreso nuclear al cliente.
   * Incluye información sobre el progreso acumulado, disponibilidad y uso previo.
   *
   * @param gameId ID de la partida
   * @param client Socket del cliente al que se enviará la información
   * @private
   */
  private async sendNuclearStatus(
    gameId: number,
    client: SocketWithUser,
  ): Promise<void> {
    try {
      // Obtener simultáneamente todos los datos del estado nuclear
      const [progress, available, used] = await Promise.all([
        this.nuclearStateRedis.getNuclearProgress(gameId, client.data.userId),
        this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
        this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
      ]);

      // Enviar estado nuclear actualizado al jugador usando el método especializado
      this.gameEventEmitter.emitNuclearStatus(
        gameId,
        progress,
        available,
        used,
      );

      this.logger.debug(
        `Estado nuclear enviado: gameId=${gameId}, userId=${client.data.userId}, ` +
          `progreso=${progress}/6, disponible=${available}, usado=${used}`,
      );
    } catch (error) {
      this.logger.error(
        `Error al enviar estado nuclear: gameId=${gameId}, userId=${client.data.userId}, error=${error}`,
      );

      this.gameEventEmitter.emitError(
        client.id,
        'Error al actualizar estado nuclear',
        'NUCLEAR_STATUS_ERROR',
      );
    }
  }
}
