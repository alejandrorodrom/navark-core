import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { SpectatorRepository } from '../../../domain/repository/spectator.repository';
import { Spectator } from '../../../../../prisma/prisma.types';

/**
 * Implementación del repositorio de espectadores utilizando Prisma.
 *
 * Permite consultar si un jugador está registrado como espectador en una partida.
 */
@Injectable()
export class SpectatorPrismaRepository implements SpectatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca un espectador específico en una partida.
   *
   * Verifica si el jugador dado ya está registrado como espectador en la partida.
   *
   * @param gameId ID de la partida
   * @param playerId ID del jugador (usuario) que se quiere verificar
   * @returns Objeto `Spectator` si existe, o `null` si no está registrado
   */
  async findFirst(gameId: number, playerId: number): Promise<Spectator | null> {
    return this.prisma.spectator.findFirst({
      where: { gameId, userId: playerId },
    });
  }
}
