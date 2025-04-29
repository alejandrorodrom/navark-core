import { Board, Ship } from '../../domain/models/board.model';
import { Shot } from '../../domain/models/shot.model';

interface VisibleShip {
  ownerId: number;
  nickname: string;
  color: string;
  positions: { row: number; col: number }[];
}

interface VisualShot {
  row: number;
  col: number;
  result: 'hit' | 'miss';
}

/**
 * Convierte cualquier valor en un objeto Board si no lo es ya.
 */
export function parseBoard(raw: unknown): Board {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as Board;
  }
  return raw as Board;
}

/**
 * Retorna solo los barcos visibles para el jugador autenticado.
 * @param ships Lista de todos los barcos.
 * @param clientUserId ID del jugador que recibe el tablero.
 * @param teams Mapa de socketId -> teamId.
 * @param gamePlayers Lista de gamePlayers (con userId).
 */
export function getVisibleShips(
  ships: Ship[],
  clientUserId: number,
  teams: Record<string, number>,
  gamePlayers: { userId: number; user: { nickname: string; color: string } }[],
): VisibleShip[] {
  const mySocketId = Object.keys(teams).find(
    (key) =>
      gamePlayers.find((p) => p.userId.toString() === key)?.userId ===
      clientUserId,
  );

  const myTeam = mySocketId ? teams[mySocketId] : null;

  const playerInfo = new Map<number, { nickname: string; color: string }>();
  for (const gp of gamePlayers) {
    playerInfo.set(gp.userId, {
      nickname: gp.user.nickname,
      color: gp.user.color,
    });
  }

  return ships
    .filter((ship) => {
      const ownerSocketId = Object.keys(teams).find(
        (socketId) =>
          gamePlayers.find((p) => p.userId.toString() === socketId)?.userId ===
          ship.ownerId,
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
 * Convierte los disparos en un formato visual simple.
 */
export function getFormattedShots(shots: Shot[]): VisualShot[] {
  return shots.map((shot) => ({
    row: shot.target.row,
    col: shot.target.col,
    result: shot.hit ? 'hit' : 'miss',
  }));
}

/**
 * Devuelve el estado detallado de los barcos pertenecientes al jugador.
 * Incluye:
 * - ID del barco.
 * - Si está completamente hundido.
 * - Las posiciones que fueron impactadas.
 * - La cantidad total de posiciones del barco.
 *
 * @param ships Lista completa de barcos en el tablero.
 * @param userId ID del jugador autenticado.
 * @returns Arreglo con el estado de cada barco del jugador.
 */
export function getMyShipsState(ships: Ship[], userId: number) {
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
