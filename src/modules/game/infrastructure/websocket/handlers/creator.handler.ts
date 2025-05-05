import { Injectable, Logger } from '@nestjs/common';
import { RoomManagerService } from '../../services/game/room/room-manager.service';
import { SocketWithUser } from '../../../domain/types/socket.types';
import { SocketServerAdapter } from '../../adapters/socket-server.adapter';
import { GameRepository } from '../../../domain/repository/game.repository';

/**
 * CreatorHandler gestiona la transferencia manual del rol de creador
 * de una partida multijugador a otro jugador conectado.
 */
@Injectable()
export class CreatorHandler {
  private readonly logger = new Logger(CreatorHandler.name);

  constructor(
    private readonly gameUtils: RoomManagerService,
    private readonly gameRepository: GameRepository,
    private readonly webSocketServerService: SocketServerAdapter,
  ) {}

  /**
   * Maneja la transferencia del rol de creador de una partida a otro jugador conectado.
   * Valída permisos, estado de la partida, y notifica a todos los jugadores.
   *
   * @param client Cliente que solicita la transferencia.
   * @param data Datos de la transferencia (gameId y targetUserId).
   */
  async onCreatorTransfer(
    client: SocketWithUser,
    data: { gameId: number; targetUserId: number },
  ): Promise<void> {
    const room = `game:${data.gameId}`;
    this.logger.log(
      `Solicitud de transferencia manual en sala ${room} por socketId=${client.id}`,
    );

    const game = await this.gameRepository.findById(data.gameId);

    if (!game) {
      this.logger.warn(
        `Intento fallido de transferencia: partida no encontrada gameId=${data.gameId}`,
      );
      client.emit('creator:transfer:ack', {
        success: false,
        error: 'Partida no encontrada',
      });
      return;
    }

    if (game.createdById !== client.data.userId) {
      this.logger.warn(
        `Intento no autorizado: userId=${client.data.userId} quiso transferir creador en gameId=${data.gameId}`,
      );
      client.emit('creator:transfer:ack', {
        success: false,
        error: 'No eres el creador actual',
      });
      return;
    }

    const server = this.webSocketServerService.getServer();

    const allSocketIds = this.gameUtils.getSocketsInRoom(room);
    const targetSocketId = [...allSocketIds].find((socketId) => {
      const targetSocket = server.sockets.sockets.get(
        socketId,
      ) as SocketWithUser;
      return targetSocket?.data?.userId === data.targetUserId;
    });

    if (!targetSocketId) {
      this.logger.warn(
        `Transferencia fallida: usuario destino userId=${data.targetUserId} no conectado en sala ${room}`,
      );
      client.emit('creator:transfer:ack', {
        success: false,
        error: 'El jugador destino no está conectado',
      });
      return;
    }

    const targetSocket = server.sockets.sockets.get(
      targetSocketId,
    ) as SocketWithUser;

    await this.gameRepository.updateGameCreator(data.gameId, data.targetUserId);

    server.to(room).emit('creator:changed', {
      newCreatorUserId: data.targetUserId,
      newCreatorNickname: targetSocket?.data?.nickname ?? 'Jugador desconocido',
    });

    client.emit('creator:transfer:ack', { success: true });

    this.logger.log(
      `Transferencia de creador exitosa en gameId=${data.gameId}: nuevo userId=${data.targetUserId} (${targetSocket?.data?.nickname ?? 'desconocido'})`,
    );
  }
}
