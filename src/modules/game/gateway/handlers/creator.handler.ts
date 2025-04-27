import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { GameUtils } from '../utils/game.utils';
import { SocketWithUser } from '../contracts/socket.types';
import { Server } from 'socket.io';

/**
 * CreatorHandler gestiona la transferencia manual del rol de creador
 * de una partida multijugador a otro jugador conectado.
 */
@Injectable()
export class CreatorHandler {
  private readonly logger = new Logger(CreatorHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly gameUtils: GameUtils,
    private readonly server: Server,
  ) {}

  /**
   * Maneja la transferencia del rol de creador de una partida a otro jugador conectado.
   * Valida permisos, estado de la partida, y notifica a todos los jugadores.
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

    const game = await this.prismaService.game.findUnique({
      where: { id: data.gameId },
    });

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

    const allSocketIds = this.gameUtils.getSocketsInRoom(room);
    const targetSocketId = [...allSocketIds].find((socketId) => {
      const targetSocket = this.server.sockets.sockets.get(
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

    const targetSocket = this.server.sockets.sockets.get(
      targetSocketId,
    ) as SocketWithUser;

    await this.prismaService.game.update({
      where: { id: data.gameId },
      data: { createdById: data.targetUserId },
    });

    this.server.to(room).emit('creator:changed', {
      newCreatorUserId: data.targetUserId,
      newCreatorNickname: targetSocket?.data?.nickname ?? 'Jugador desconocido',
    });

    client.emit('creator:transfer:ack', { success: true });

    this.logger.log(
      `Transferencia de creador exitosa en gameId=${data.gameId}: nuevo userId=${data.targetUserId} (${targetSocket?.data?.nickname ?? 'desconocido'})`,
    );
  }
}
