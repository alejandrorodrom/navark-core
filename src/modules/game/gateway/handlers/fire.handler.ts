import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SocketWithUser } from '../contracts/socket.types';
import { PlayerFireDto } from '../contracts/player-fire.dto';
import { WebSocketServerService } from '../services/web-socket-server.service';
import { TurnStateRedis } from '../redis/turn-state.redis';
import { NuclearStateRedis } from '../redis/nuclear-state.redis';
import { TurnTimeoutService } from '../services/turn-timeout.service';
import { TurnManagerService } from '../services/turn-manager.service';
import { ShotService } from '../services/shot.service';
import { Board } from '../../domain/models/board.model';
import { ShotType } from '../../domain/models/shot.model';
import { BoardHandler } from './board.handler';
import { GameStatus } from '../../../../prisma/prisma.enum';
import { parseBoard } from '../utils/board.utils';

/**
 * FireHandler gestiona la acción de disparo durante una partida:
 * - Validaciones de turno, disparo y tablero.
 * - Actualización del tablero global (Game.board).
 * - Eliminación de jugadores sin barcos.
 * - Actualización de progreso nuclear.
 * - Avance del turno.
 */
@Injectable()
export class FireHandler {
  private readonly logger = new Logger(FireHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly turnStateRedis: TurnStateRedis,
    private readonly nuclearStateRedis: NuclearStateRedis,
    private readonly turnTimeoutService: TurnTimeoutService,
    private readonly turnManagerService: TurnManagerService,
    private readonly webSocketServerService: WebSocketServerService,
    private readonly shotService: ShotService,
    private readonly boardHandler: BoardHandler,
  ) {}

  async onPlayerFire(
    client: SocketWithUser,
    data: PlayerFireDto,
  ): Promise<void> {
    const { gameId, x, y, shotType } = data;
    const room = `game:${gameId}`;

    this.logger.log(
      `Disparo recibido: socketId=${client.id}, gameId=${gameId}, coordenadas=(${x},${y}), tipo=${shotType}`,
    );

    const game = await this.prismaService.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== GameStatus.in_progress) {
      client.emit('player:fire:ack', {
        success: false,
        error: 'Partida no disponible para disparar.',
      });
      return;
    }

    const currentTurnUserId = await this.turnStateRedis.getCurrentTurn(gameId);
    if (currentTurnUserId !== client.data.userId) {
      client.emit('player:fire:ack', {
        success: false,
        error: 'No es tu turno',
      });
      return;
    }

    if (!game.board) {
      client.emit('player:fire:ack', {
        success: false,
        error: 'Tablero no encontrado.',
      });
      return;
    }

    const board = parseBoard(game.board);

    if (!board.shots) {
      board.shots = [];
    }

    const alreadyShot = board.shots?.some(
      (shot) => shot.target.row === y && shot.target.col === x,
    );

    if (alreadyShot) {
      client.emit('player:fire:ack', {
        success: false,
        error: 'Ya disparaste en esta posición.',
      });
      this.logger.warn(
        `Disparo repetido bloqueado: socketId=${client.id}, gameId=${gameId}, coordenadas=(${x},${y})`,
      );
      return;
    }

    // Registrar disparo
    const result = await this.shotService.registerShot({
      gameId,
      shooterId: client.data.userId,
      type: shotType,
      target: { row: y, col: x },
      board,
    });

    const server = this.webSocketServerService.getServer();

    server.to(room).emit('player:fired', {
      shooterUserId: client.data.userId,
      x,
      y,
      hit: result.shot.hit,
      sunk: result.shot.sunkShipId !== undefined,
    });

    await this.prismaService.game.update({
      where: { id: gameId },
      data: { board: JSON.stringify(result.updatedBoard) },
    });

    if (result.shot.hit) {
      const hitShip = result.updatedBoard.ships.find((ship) =>
        ship.positions.some(
          (p) =>
            p.row === result.shot.target.row &&
            p.col === result.shot.target.col,
        ),
      );
      const hitShipOwnerId = hitShip?.ownerId;

      if (hitShipOwnerId !== null && hitShipOwnerId !== undefined) {
        const playerStillAlive = result.updatedBoard.ships.some(
          (ship) => ship.ownerId === hitShipOwnerId && !ship.isSunk,
        );

        if (!playerStillAlive) {
          await this.prismaService.gamePlayer.updateMany({
            where: { gameId, userId: hitShipOwnerId },
            data: { leftAt: new Date() },
          });

          server.to(room).emit('player:eliminated', {
            userId: hitShipOwnerId,
          });

          this.logger.log(
            `Jugador userId=${hitShipOwnerId} eliminado al perder todos sus barcos.`,
          );
        }
      }
    }

    await this.handleNuclearProgress(
      gameId,
      client.data.userId,
      result.shot.hit,
      shotType,
    );

    await this.sendNuclearStatus(gameId, client);

    client.emit('player:fire:ack', {
      success: true,
      hit: result.shot.hit,
      sunk: result.shot.sunkShipId !== undefined,
    });

    await this.boardHandler.sendBoardUpdate(client, gameId);

    await this.turnTimeoutService.clearTurnTimeout(gameId);
    await this.turnManagerService.passTurn(gameId, client.data.userId);
  }

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
      this.logger.log(
        `Usuario ${userId} desbloqueó bomba nuclear en partida ${gameId}`,
      );
    }
  }

  private async sendNuclearStatus(
    gameId: number,
    client: SocketWithUser,
  ): Promise<void> {
    const [progress, available, used] = await Promise.all([
      this.nuclearStateRedis.getNuclearProgress(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearAvailable(gameId, client.data.userId),
      this.nuclearStateRedis.hasNuclearUsed(gameId, client.data.userId),
    ]);

    client.emit('nuclear:status', {
      progress,
      hasNuclear: available,
      used,
    });
  }
}
