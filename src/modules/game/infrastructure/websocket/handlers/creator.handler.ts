import { Injectable, Logger } from '@nestjs/common';
import { LobbyManager } from '../../managers/lobby.manager';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameEvents } from '../events/constants/game-events.enum';
import { EventPayload } from '../events/types/events-payload.type';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';

/**
 * Servicio especializado en la gestión del rol de administrador (creador) de partidas,
 * permitiendo la transferencia controlada de privilegios entre jugadores.
 *
 * El rol de creador en una partida otorga permisos especiales como:
 * - Capacidad para iniciar la partida
 * - Expulsar jugadores problemáticos
 * - Configurar parámetros del juego
 * - Transferir el rol a otro jugador
 *
 * Esta funcionalidad es especialmente útil cuando el creador original debe abandonar
 * la partida pero desea que ésta continúe bajo la administración de otro jugador de confianza.
 */
@Injectable()
export class CreatorHandler {
  private readonly logger = new Logger(CreatorHandler.name);

  constructor(
    private readonly lobbyManager: LobbyManager,
    private readonly gameRepository: GameRepository,
    private readonly socketServerAdapter: SocketServerAdapter,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Procesa y ejecuta la solicitud de transferencia del rol de creador a otro jugador.
   *
   * Este método implementa un flujo completo de validación y ejecución que incluye:
   * 1. Verificación de existencia de la partida solicitada
   * 2. Validación de permisos del solicitante (debe ser el creador actual)
   * 3. Verificación de que el jugador destino esté activamente conectado
   * 4. Actualización del rol en la base de datos
   * 5. Notificación a todos los participantes sobre el cambio de administración
   *
   * El proceso incorpora múltiples validaciones de seguridad para garantizar
   * que solo transferencias legítimas y autorizadas sean procesadas.
   *
   * @param client Socket del cliente que solicita la transferencia (debe ser el creador actual)
   * @param data Objeto con el ID de la partida y el ID del usuario destino
   * @returns Promesa que se resuelve cuando todo el proceso ha sido completado
   */
  async onCreatorTransfer(
    client: SocketWithUser,
    data: EventPayload<GameEvents.CREATOR_TRANSFER>,
  ): Promise<void> {
    const { gameId, targetUserId } = data;
    const requesterId = client.data.userId;
    const requesterNickname = client.data.nickname || 'Desconocido';

    this.logger.log(
      `Solicitud de transferencia de creador: gameId=${gameId}, solicitante=${requesterNickname} (userId=${requesterId}), destino=${targetUserId}`,
    );

    try {
      // Verificar que la partida exista en la base de datos
      const game = await this.gameRepository.findById(gameId);

      if (!game) {
        this.logger.warn(
          `Transferencia denegada: partida no encontrada gameId=${gameId}`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Partida no encontrada',
        );
        return;
      }

      // Validar que quien solicita la transferencia sea el creador actual
      if (game.createdById !== requesterId) {
        this.logger.warn(
          `Transferencia denegada: userId=${requesterId} intentó transferir sin ser creador en gameId=${gameId} (creador actual=${game.createdById})`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'No tienes permisos para transferir el rol de creador',
        );
        return;
      }

      // Verificar que el destino no sea el mismo creador actual
      if (game.createdById === targetUserId) {
        this.logger.warn(
          `Transferencia redundante: userId=${requesterId} intentó transferir a sí mismo en gameId=${gameId}`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Ya eres el creador de esta partida',
        );
        return;
      }

      // Buscar el socket del jugador destino
      const userMap = this.socketServerAdapter.getUsersInGame(gameId);
      const targetSocketIds = userMap.get(targetUserId);

      // Verificar que el jugador destino esté activamente conectado
      if (!targetSocketIds || targetSocketIds.length === 0) {
        this.logger.warn(
          `Transferencia fallida: usuario destino userId=${targetUserId} no está conectado en gameId=${gameId}`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'El jugador destino no está conectado a la partida',
        );
        return;
      }

      // Obtener datos del jugador destino
      const targetSocketId = targetSocketIds[0];
      const targetUserData =
        this.socketServerAdapter.getSocketUserData(targetSocketId);

      if (!targetUserData) {
        this.logger.error(
          `Error interno: no se pudieron obtener datos de usuario para socketId=${targetSocketId}`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Error interno al obtener datos del usuario destino',
        );
        return;
      }

      // Actualizar el creador en la base de datos
      await this.gameRepository.updateGameCreator(gameId, targetUserId);
      this.logger.debug(
        `Registro de creador actualizado en base de datos: gameId=${gameId}, nuevoCreador=${targetUserId}`,
      );

      // Notificar a todos los participantes sobre el cambio de creador
      this.gameEventEmitter.emitCreatorChanged(
        gameId,
        targetUserId,
        targetUserData.nickname,
      );

      // Confirmar al solicitante que la transferencia fue exitosa
      this.gameEventEmitter.emitCreatorTransferAck(client.id, true);

      this.logger.log(
        `Transferencia de creador exitosa: gameId=${gameId}, anterior=${requesterNickname} (${requesterId}), nuevo=${targetUserData.nickname} (${targetUserId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error al procesar transferencia de creador en gameId=${gameId}`,
        error,
      );

      this.gameEventEmitter.emitCreatorTransferAck(
        client.id,
        false,
        'Error interno al procesar la transferencia',
      );
    }
  }
}
