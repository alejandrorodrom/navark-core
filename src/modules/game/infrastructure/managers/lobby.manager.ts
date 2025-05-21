import { Injectable, Logger } from '@nestjs/common';
import { SocketServerAdapter } from '../adapters/socket-server.adapter';
import { GameEventEmitter } from '../websocket/events/emitters/game-event.emitter';

/**
 * Servicio encargado de gestionar el estado del lobby de una partida.
 *
 * Sus responsabilidades incluyen:
 * - Expulsar a todos los jugadores y espectadores de una sala.
 * - Notificar que una partida ha sido abandonada.
 */
@Injectable()
export class LobbyManager {
  private readonly logger = new Logger(LobbyManager.name);

  constructor(
    private readonly socketServer: SocketServerAdapter,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Expulsa todos los jugadores y espectadores de una sala de juego.
   *
   * Este método se utiliza cuando una partida es abandonada por todos los jugadores,
   * o es eliminada desde el backend. Emite un evento de abandono y desconecta a todos
   * los sockets que estén presentes en la sala correspondiente.
   *
   * @param gameId Identificador único de la partida (sala de Socket.IO)
   * @returns `Promise<void>`
   */
  async kickPlayersFromRoom(gameId: number): Promise<void> {
    const socketIds = this.socketServer.getSocketsInGame(gameId);

    if (socketIds.length === 0) {
      this.logger.log(
        `No hay jugadores en la sala game:${gameId} para expulsar`,
      );
      return;
    }

    // 1. Emitir evento de abandono para que el frontend actualice su estado
    this.gameEventEmitter.emitGameAbandoned(gameId);

    // 2. Hacer que cada socket abandone la sala explícitamente
    for (const socketId of socketIds) {
      await this.socketServer.leaveGameRoom(socketId, gameId);
    }

    // 3. Confirmar en logs la acción realizada
    this.logger.log(
      `${socketIds.length} jugadores y espectadores fueron expulsados de la sala game:${gameId} por abandono`,
    );
  }
}
