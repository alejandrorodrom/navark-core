import { Injectable } from '@nestjs/common';
import { Shot, VisualShot } from '../../domain/models/shot.model';
import { Ship, MyShipState, VisibleShip } from '../../domain/models/ship.model';
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
   * 2. Un jugador ve los barcos de sus compañeros de equipo (en modo equipos).
   * 3. Un jugador NO ve los barcos enemigos.
   *
   * @param ships Lista completa de barcos en el tablero.
   * @param clientUserId ID del jugador que solicita su vista personalizada.
   * @param teams Mapa userId → teamId (Record<number, number>).
   * @param gamePlayers Lista de jugadores con su información de usuario.
   * @returns Lista de barcos visibles al jugador, enriquecidos con nickname y color.
   */
  getVisibleShips(
    ships: Ship[],
    clientUserId: number,
    teams: Record<number, number>,
    gamePlayers: GamePlayerWithUser[],
  ): VisibleShip[] {
    const myTeam = teams[clientUserId] ?? null;

    // Crear un mapa con nickname y color por userId
    const playerInfo = new Map<number, { nickname: string; color: string }>();
    for (const gp of gamePlayers) {
      playerInfo.set(gp.userId, {
        nickname: gp.user.nickname,
        color: gp.user.color,
      });
    }

    // Filtrar barcos visibles y enriquecer con datos visuales
    return ships
      .filter((ship) => {
        if (ship.ownerId === null) return false;
        const ownerTeam = teams[ship.ownerId] ?? null;
        return ship.ownerId === clientUserId || ownerTeam === myTeam;
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
   * Cada disparo se convierte en un objeto `{ row, col, result }` donde result es 'hit' o 'miss'.
   * Este formato es ideal para renderizado gráfico en la interfaz del cliente.
   *
   * @param shots Lista completa de disparos registrados
   * @returns Lista simplificada de disparos visuales
   */
  getFormattedShots(shots: Shot[]): VisualShot[] {
    return shots.map((shot) => ({
      row: shot.target.row,
      col: shot.target.col,
      result: shot.hit ? 'hit' : 'miss',
    }));
  }

  /**
   * Devuelve el estado detallado de los barcos propios del jugador.
   *
   * Esto incluye:
   * - Cuáles posiciones están impactadas
   * - Si el barco está completamente hundido
   * - Tamaño total del barco
   *
   * Esta información permite calcular el daño recibido y renderizar gráficamente el estado del jugador.
   *
   * @param ships Lista completa de barcos
   * @param userId ID del jugador que consulta
   * @returns Estado detallado de cada barco propio
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
