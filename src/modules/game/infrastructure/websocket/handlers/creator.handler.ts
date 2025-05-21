import { Injectable, Logger } from '@nestjs/common';
import { LobbyManager } from '../../managers/lobby.manager';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';
import { GameEvents } from '../events/constants/game-events.enum';
import { EventPayload } from '../events/types/events-payload.type';
import { GameEventEmitter } from '../events/emitters/game-event.emitter';

/**
 * Servicio especializado en la gestión del rol de administrador (creador) de partidas.
 *
 * Este rol permite:
 * - Iniciar partidas
 * - Expulsar jugadores
 * - Transferir el control a otro jugador
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
   * Maneja la solicitud de transferencia de rol de creador a otro jugador conectado.
   *
   * Flujo:
   * 1. Verifica existencia de partida.
   * 2. Comprueba permisos del solicitante.
   * 3. Verifica conexión activa del destino.
   * 4. Actualiza base de datos.
   * 5. Notifica a todos los jugadores.
   *
   * @param client Socket del jugador que solicita la transferencia (debe ser el creador actual).
   * @param data Contiene el `gameId` y el `targetUserId` que recibirá el rol.
   * @returns Promesa que se resuelve al finalizar la operación.
   */
  async onCreatorTransfer(
    client: SocketWithUser,
    data: EventPayload<GameEvents.CREATOR_TRANSFER>,
  ): Promise<void> {
    const { gameId, targetUserId } = data;
    const requesterId = client.data.userId;
    const requesterNickname = client.data.nickname || 'Desconocido';

    this.logger.log(
      `Solicitud de transferencia: gameId=${gameId}, de userId=${requesterId} - ${requesterNickname} a userId=${targetUserId}`,
    );

    try {
      // 1. Verificar existencia de la partida
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        this.logger.warn(`Partida no encontrada: gameId=${gameId}`);
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Partida no encontrada',
        );
        return;
      }

      // 2. Validar que quien transfiere sea el creador
      if (game.createdById !== requesterId) {
        this.logger.warn(
          `Transferencia denegada: userId=${requesterId} no es el creador actual`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'No tienes permisos para transferir el rol de creador',
        );
        return;
      }

      // 3. Validar que no se transfiera a sí mismo
      if (targetUserId === requesterId) {
        this.logger.warn(`Transferencia redundante al mismo creador`);
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Ya eres el creador de esta partida',
        );
        return;
      }

      // 4. Verificar que el usuario destino esté conectado
      const userMap = this.socketServerAdapter.getUsersInGame(gameId);
      const targetSocketIds = userMap.get(targetUserId);

      if (!targetSocketIds || targetSocketIds.length === 0) {
        this.logger.warn(
          `Transferencia fallida: userId=${targetUserId} no está conectado`,
        );
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'El jugador destino no está conectado a la partida',
        );
        return;
      }

      const targetSocketId = targetSocketIds[0];
      const targetUserData =
        this.socketServerAdapter.getSocketUserData(targetSocketId);

      if (!targetUserData) {
        this.logger.error(`Datos de usuario destino no disponibles`);
        this.gameEventEmitter.emitCreatorTransferAck(
          client.id,
          false,
          'Error al obtener datos del usuario destino',
        );
        return;
      }

      // 5. Actualizar base de datos con el nuevo creador
      await this.gameRepository.updateGameCreator(gameId, targetUserId);

      // 6. Notificar cambio de creador a todos los jugadores
      this.gameEventEmitter.emitCreatorChanged(
        gameId,
        targetUserId,
        targetUserData.nickname,
      );

      // 7. Confirmar al solicitante que fue exitoso
      this.gameEventEmitter.emitCreatorTransferAck(client.id, true);

      this.logger.log(
        `Transferencia completada: gameId=${gameId}, nuevo creador=${targetUserData.nickname} (userId=${targetUserId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error interno al transferir rol de creador en gameId=${gameId}`,
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
