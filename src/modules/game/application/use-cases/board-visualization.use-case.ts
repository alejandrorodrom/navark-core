import { Injectable } from '@nestjs/common';
import { Shot, VisualShot } from '../../domain/models/shot.model';
import {
  Ship,
  MyShipState,
  VisibleShip,
} from '../../domain/models/ship.model';
import { GamePlayerWithUser } from '../../../../prisma/prisma.types';

/**
 * Servicio de visualización del tablero personalizado por jugador.
 *
 * Este servicio proporciona información procesada del tablero de juego
 * para ser enviada a cada jugador según su punto de vista, permitiendo:
 *
 * - Ver sus propios barcos y los de su equipo (modo teams).
 * - Obtener estado detallado de sus barcos.
 * - Visualizar disparos pasados (impacto o fallo).
 */
@Injectable()
export class BoardVisualizationUseCase {
  /**
   * Filtra y retorna los barcos que deberían ser visibles para el jugador solicitante.
   *
   * La visibilidad se determina por las siguientes reglas:
   * 1. Un jugador siempre ve sus propios barcos completos.
   * 2. Un jugador ve los barcos de sus compañeros de equipo (en modo equipo).
   * 3. Un jugador NO ve los barcos enemigos (a menos que sean impactados, en visualización futura).
   *
   * Se enriquece cada barco con datos del jugador propietario (nickname y color).
   *
   * @param ships Lista completa de barcos en el tablero
   * @param clientUserId ID del jugador que solicita su vista personalizada
   * @param teams Mapa socketId (o userId string) → teamId, para identificar compañeros
   * @param gamePlayers Lista de jugadores en la partida con sus usuarios
   * @returns Lista de barcos visibles al jugador con información adicional
   */
  getVisibleShips(
    ships: Ship[],
    clientUserId: number,
    teams: Record<string, number>,
    gamePlayers: GamePlayerWithUser[],
  ): VisibleShip[] {
    // Identificar el equipo del jugador solicitante
    const mySocketId = Object.keys(teams).find(
      (key) =>
        gamePlayers.find((p) => p.userId.toString() === key)?.userId ===
        clientUserId,
    );
    const myTeam = mySocketId ? teams[mySocketId] : null;

    // Mapear info visual (nickname y color) por userId
    const playerInfo = new Map<number, { nickname: string; color: string }>();
    for (const gp of gamePlayers) {
      playerInfo.set(gp.userId, {
        nickname: gp.user.nickname,
        color: gp.user.color,
      });
    }

    return ships
      .filter((ship) => {
        // Determinar el equipo del dueño del barco
        const ownerSocketId = Object.keys(teams).find(
          (socketId) =>
            gamePlayers.find((p) => p.userId.toString() === socketId)
              ?.userId === ship.ownerId,
        );
        const ownerTeam = ownerSocketId ? teams[ownerSocketId] : null;

        const isVisible = ship.ownerId === clientUserId || ownerTeam === myTeam;

        return isVisible && ship.ownerId !== null;
      })
      .map((ship) => ({
        ownerId: ship.ownerId!,
        nickname: playerInfo.get(ship.ownerId!)?.nickname || '',
        color: playerInfo.get(ship.ownerId!)?.color || '',
        positions: ship.positions,
      }));
  }

  /**
   * Transforma la lista de disparos en el tablero a un formato visual simplificado.
   *
   * Cada disparo se representa con coordenadas y resultado ("hit" o "miss"),
   * permitiendo su renderización gráfica en la interfaz cliente.
   *
   * @param shots Lista completa de disparos registrados en el tablero
   * @returns Lista de disparos visuales simplificados
   */
  getFormattedShots(shots: Shot[]): VisualShot[] {
    return shots.map((shot) => ({
      row: shot.target.row,
      col: shot.target.col,
      result: shot.hit ? 'hit' : 'miss',
    }));
  }

  /**
   * Proporciona el estado detallado de los barcos propios del jugador.
   *
   * Incluye:
   * - ID del barco
   * - Si está hundido
   * - Posiciones impactadas
   * - Tamaño del barco
   *
   * Esta información permite al cliente mostrar el estado de daño de cada barco
   * y calcular indicadores como porcentaje de flota destruida.
   *
   * @param ships Lista completa de barcos del tablero
   * @param userId ID del jugador que consulta su estado de flota
   * @returns Lista detallada del estado de cada barco propio
   */
  getMyShipsState(ships: Ship[], userId: number): MyShipState[] {
    return ships
      .filter((ship) => ship.ownerId === userId)
      .map((ship) => ({
        shipId: ship.shipId,
        isSunk: ship.isSunk,
        impactedPositions: ship.positions
          .filter((pos) => pos.isHit)
          .map((pos) => ({ row: pos.row, col: pos.col })),
        totalPositions: ship.positions.length,
      }));
  }
}
