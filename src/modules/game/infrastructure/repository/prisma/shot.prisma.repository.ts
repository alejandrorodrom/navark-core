import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { ShotRepository } from '../../../domain/repository/shot.repository';
import { Shot } from '../../../../../prisma/prisma.types';
import { ShotTarget, ShotType } from '../../../domain/models/shot.model';

/**
 * Implementación del repositorio de disparos utilizando Prisma.
 *
 * Permite registrar disparos realizados por jugadores durante una partida.
 */
@Injectable()
export class ShotPrismaRepository implements ShotRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un nuevo disparo en la base de datos.
   *
   * Este método guarda información del disparo, incluyendo:
   * - ID del juego
   * - ID del jugador que disparó
   * - Tipo de disparo (simple, cruz, múltiple, etc.)
   * - Coordenada objetivo
   * - Si el disparo fue un acierto (`hit`)
   *
   * @param gameId ID de la partida donde ocurrió el disparo
   * @param shooterId ID del jugador que realizó el disparo
   * @param type Tipo de disparo realizado
   * @param target Coordenada objetivo del disparo
   * @param hit `true` si fue un impacto, `false` si falló
   * @returns Disparo registrado en la base de datos
   */
  registerShot(
    gameId: number,
    shooterId: number,
    type: ShotType,
    target: ShotTarget,
    hit: boolean,
  ): Promise<Shot> {
    return this.prisma.shot.create({
      data: {
        gameId,
        shooterId,
        type,
        target,
        hit,
      },
    });
  }
}
