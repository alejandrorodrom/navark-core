import { Shot, VisualShot } from '../models/shot.model';
import { MyShipState, Ship, VisibleShip } from '../models/ship.model';
import { GamePlayerWithUser } from '../../../../prisma/prisma.types';

/**
 * Filtra y retorna los barcos que deberían ser visibles para el jugador solicitante.
 * En el juego, un jugador solo puede ver sus propios barcos y los de su equipo,
 * pero no los barcos de los jugadores enemigos (a menos que sean impactados).
 *
 * La visibilidad se determina por las siguientes reglas:
 * 1. Un jugador siempre ve sus propios barcos completos
 * 2. Un jugador ve los barcos de sus compañeros de equipo (en modo equipo)
 * 3. Un jugador NO ve los barcos de los equipos o jugadores enemigos
 *
 * La función también enriquece los datos con información del jugador propietario
 * como su nickname y color asignado para visualización en la interfaz.
 *
 * @param ships - Lista completa de todos los barcos en el tablero
 * @param clientUserId - ID del usuario para el que se filtrarán los barcos visibles
 * @param teams - Mapa que relaciona IDs de socket con IDs de equipo
 * @param gamePlayers - Información completa de los jugadores en la partida
 * @returns Lista filtrada de barcos visibles con información adicional
 */
export function getVisibleShips(
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

  // Crear un mapa para acceso rápido a la información de los jugadores
  const playerInfo = new Map<number, { nickname: string; color: string }>();
  for (const gp of gamePlayers) {
    playerInfo.set(gp.userId, {
      nickname: gp.user.nickname,
      color: gp.user.color,
    });
  }

  // Filtrar los barcos según reglas de visibilidad
  return (
    ships
      .filter((ship) => {
        // Determinar el equipo del propietario del barco
        const ownerSocketId = Object.keys(teams).find(
          (socketId) =>
            gamePlayers.find((p) => p.userId.toString() === socketId)
              ?.userId === ship.ownerId,
        );
        const ownerTeam = ownerSocketId ? teams[ownerSocketId] : null;

        // Un barco es visible si:
        // - Es propio del jugador, o
        // - Pertenece a un compañero de equipo (mismo myTeam)
        const isVisible = ship.ownerId === clientUserId || ownerTeam === myTeam;

        // No mostrar barcos sin propietario (posiblemente eliminados)
        return isVisible && ship.ownerId !== null;
      })
      // Transformar los barcos para incluir información visual adicional
      .map((ship) => ({
        ownerId: ship.ownerId!,
        nickname: playerInfo.get(ship.ownerId!)?.nickname || '',
        color: playerInfo.get(ship.ownerId!)?.color || '',
        positions: ship.positions,
      }))
  );
}

/**
 * Transforma la lista de disparos registrados en el tablero a un formato
 * visual simplificado para su renderización en la interfaz del cliente.
 *
 * Cada disparo se convierte en un objeto con coordenadas (row, col) y un
 * resultado visual ('hit' para impactos, 'miss' para fallos) que facilita
 * su representación gráfica en el tablero.
 *
 * @param shots - Lista de objetos Shot con información detallada de cada disparo
 * @returns Lista de objetos VisualShot simplificados para renderizado
 */
export function getFormattedShots(shots: Shot[]): VisualShot[] {
  return shots.map((shot) => ({
    row: shot.target.row,
    col: shot.target.col,
    result: shot.hit ? 'hit' : 'miss',
  }));
}

/**
 * Proporciona información detallada sobre los barcos pertenecientes al jugador solicitante.
 *
 * Esta función es crucial para que cada jugador pueda monitorear el estado de su flota.
 * A diferencia de getVisibleShips, esta función se enfoca exclusivamente en los barcos
 * propios del jugador y proporciona información adicional sobre:
 *
 * 1. El identificador único de cada barco
 * 2. Si el barco está completamente hundido
 * 3. Qué posiciones específicas han sido impactadas por disparos enemigos
 * 4. El tamaño total del barco (número de posiciones)
 *
 * Esta información permite al cliente representar visualmente el estado de daño
 * de cada barco del jugador y calcular estadísticas como porcentaje de flota destruida.
 *
 * @param ships - Lista completa de todos los barcos en el tablero
 * @param userId - ID del jugador cuyos barcos se quieren consultar
 * @returns Lista de objetos MyShipState con el estado detallado de cada barco del jugador
 */
export function getMyShipsState(ships: Ship[], userId: number): MyShipState[] {
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
