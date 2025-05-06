import { Injectable, Logger } from '@nestjs/common';
import { SocketServerAdapter } from '../../../adapters/socket-server.adapter';
import { GameEventEmitter } from '../../../websocket/events/emitters/game-event.emitter';

@Injectable()
export class LobbyManagerService {
  private readonly logger = new Logger(LobbyManagerService.name);

  constructor(
    private readonly socketServer: SocketServerAdapter,
    private readonly gameEventEmitter: GameEventEmitter,
  ) {}

  /**
   * Expulsa todos los jugadores y espectadores de una sala de juego
   * @param gameId Identificador de la partida
   */
  async kickPlayersFromRoom(gameId: number): Promise<void> {
    const socketIds = this.socketServer.getSocketsInGame(gameId);

    if (socketIds.length === 0) {
      this.logger.log(
        `No hay jugadores en la sala game:${gameId} para expulsar`,
      );
      return;
    }

    // Emitimos el evento de juego abandonado
    this.gameEventEmitter.emitGameAbandoned(gameId);

    // Hacemos que los sockets abandonen la sala usando el método proporcionado por SocketServerAdapter
    for (const socketId of socketIds) {
      await this.socketServer.leaveGameRoom(socketId, gameId);
    }

    this.logger.log(
      `${socketIds.length} jugadores y espectadores fueron expulsados de la sala game:${gameId} por abandono`,
    );
  }
}
