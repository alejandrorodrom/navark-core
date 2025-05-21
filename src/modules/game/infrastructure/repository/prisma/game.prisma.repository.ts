import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { GameRepository } from '../../../domain/repository/game.repository';
import { CreateGameDto } from '../../../domain/dto/create-game.dto';
import {
  Game,
  GameWithPlayers,
  GameWithPlayersAndSpectator,
  GameWithPlayersAndUsers,
} from '../../../../../prisma/prisma.types';
import { MatchmakingDto } from '../../../domain/dto/matchmaking.dto';
import { GameStatus } from '../../../../../prisma/prisma.enum';
import { Board } from '../../../domain/models/board.model';

/**
 * Repositorio concreto para acceder a la tabla `Game` usando Prisma.
 *
 * Implementa todas las operaciones necesarias para:
 * - Crear partidas manuales o por matchmaking
 * - Consultar partidas con relaciones cargadas (jugadores, espectadores)
 * - Actualizar estado y tablero
 * - Eliminar partidas abandonadas
 */
@Injectable()
export class GamePrismaRepository implements GameRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una partida personalizada (manual) e inserta al jugador como creador.
   *
   * @param dto Datos básicos de la partida
   * @param userId ID del usuario que la crea
   * @returns Partida creada
   */
  async createGameWithPlayer(
    dto: CreateGameDto,
    userId: number,
  ): Promise<Game> {
    const game = await this.prisma.game.create({
      data: {
        name: dto.name,
        accessCode: dto.accessCode,
        isPublic: dto.isPublic,
        isMatchmaking: false,
        maxPlayers: dto.maxPlayers,
        mode: dto.mode,
        difficulty: dto.difficulty,
        teamCount: dto.mode === 'teams' ? dto.teamCount : null,
        createdById: userId,
        status: GameStatus.waiting,
      },
    });

    await this.prisma.gamePlayer.create({
      data: {
        userId,
        gameId: game.id,
        team: null,
      },
    });

    return game;
  }

  /**
   * Intenta encontrar una partida disponible por matchmaking. Si no hay, crea una nueva.
   *
   * @param dto Preferencias del jugador para la partida
   * @param userId ID del jugador que busca partida
   * @returns Partida encontrada o creada
   */
  async findOrCreateMatch(dto: MatchmakingDto, userId: number): Promise<Game> {
    const found = await this.prisma.game.findFirst({
      where: {
        isMatchmaking: true,
        status: GameStatus.waiting,
        mode: dto.mode ?? undefined,
        maxPlayers: dto.maxPlayers ?? undefined,
        difficulty: dto.difficulty ?? undefined,
      },
      include: { gamePlayers: true },
    });

    if (found && found.gamePlayers.length < found.maxPlayers) {
      await this.prisma.gamePlayer.create({
        data: {
          userId,
          gameId: found.id,
          team: null,
        },
      });
      return found;
    }

    const newGame = await this.prisma.game.create({
      data: {
        isPublic: false,
        isMatchmaking: true,
        maxPlayers: dto.maxPlayers ?? 2,
        mode: dto.mode ?? 'individual',
        difficulty: dto.difficulty ?? 'medium',
        teamCount: dto.mode === 'teams' ? 2 : null,
        createdById: userId,
        status: GameStatus.waiting,
      },
    });

    await this.prisma.gamePlayer.create({
      data: {
        userId,
        gameId: newGame.id,
        team: null,
      },
    });

    return newGame;
  }

  /**
   * Busca una partida por ID incluyendo solo los jugadores.
   *
   * @param id ID de la partida
   * @returns Partida con jugadores o `null`
   */
  async findByIdWithPlayers(id: number): Promise<GameWithPlayers | null> {
    return this.prisma.game.findUnique({
      where: { id },
      include: { gamePlayers: true },
    });
  }

  /**
   * Busca una partida incluyendo jugadores y su información de usuario.
   *
   * @param id ID de la partida
   * @returns Partida con jugadores y usuarios relacionados o `null`
   */
  async findByIdWithPlayersAndUsers(
    id: number,
  ): Promise<GameWithPlayersAndUsers | null> {
    return this.prisma.game.findUnique({
      where: { id },
      include: {
        gamePlayers: {
          include: { user: true },
        },
      },
    });
  }

  /**
   * Obtiene una partida con jugadores y espectadores relacionados.
   *
   * @param id ID de la partida
   * @returns Partida con jugadores y espectadores o `null`
   */
  async findByIdWithPlayersAndSpectator(
    id: number,
  ): Promise<GameWithPlayersAndSpectator | null> {
    return this.prisma.game.findUnique({
      where: { id },
      include: { gamePlayers: true, spectators: true },
    });
  }

  /**
   * Obtiene una partida por ID sin relaciones.
   *
   * @param id ID de la partida
   * @returns Partida encontrada o `null`
   */
  async findById(id: number): Promise<Game | null> {
    return this.prisma.game.findUnique({
      where: { id },
    });
  }

  /**
   * Actualiza el creador (userId) de una partida.
   *
   * @param gameId ID de la partida
   * @param userId ID del nuevo creador
   * @returns Partida actualizada
   */
  async updateGameCreator(gameId: number, userId: number): Promise<Game> {
    return this.prisma.game.update({
      where: { id: gameId },
      data: { createdById: userId },
    });
  }

  /**
   * Inicia la partida: actualiza el estado a `in_progress` y guarda el tablero inicial.
   *
   * @param gameId ID de la partida
   * @param board Tablero inicial serializado
   * @returns Partida actualizada
   */
  async updateGameStartBoard(gameId: number, board: Board): Promise<Game> {
    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: GameStatus.in_progress,
        board: JSON.stringify(board),
      },
    });
  }

  /**
   * Actualiza el tablero de juego en curso (sin cambiar estado).
   *
   * @param gameId ID de la partida
   * @param board Tablero actualizado
   * @returns Partida actualizada
   */
  async updateGameBoard(gameId: number, board: Board): Promise<Game> {
    return this.prisma.game.update({
      where: { id: gameId },
      data: {
        board: JSON.stringify(board),
      },
    });
  }

  /**
   * Marca una partida como finalizada (`finished`).
   *
   * @param gameId ID de la partida
   * @returns Partida actualizada
   */
  async markGameAsFinished(gameId: number): Promise<Game> {
    return this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.finished },
    });
  }

  /**
   * Elimina completamente una partida abandonada, incluyendo:
   * - Disparos (`Shot`)
   * - Espectadores (`Spectator`)
   * - Jugadores (`GamePlayer`)
   * - La propia `Game`
   *
   * @param id ID de la partida
   * @returns Partida eliminada
   */
  async removeAbandonedGames(id: number): Promise<Game> {
    return this.prisma.$transaction(async (tx) => {
      await tx.shot.deleteMany({ where: { gameId: id } });
      await tx.spectator.deleteMany({ where: { gameId: id } });
      await tx.gamePlayer.deleteMany({ where: { gameId: id } });
      return tx.game.delete({
        where: { id },
      });
    });
  }
}
