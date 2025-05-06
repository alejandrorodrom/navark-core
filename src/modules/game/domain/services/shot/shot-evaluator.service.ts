import { Ship } from '../../models/ship.model';
import { ShotResult } from '../../models/shot.model';

/**
 * Servicio especializado en la evaluación y procesamiento de disparos en el tablero de juego.
 *
 * Esta clase utilitaria estática proporciona la lógica central para determinar el resultado
 * de cada disparo realizado por los jugadores durante una partida, resolviendo:
 * - Si el disparo impactó algún barco
 * - Qué posición específica del barco fue impactada
 * - Si el impacto resultó en el hundimiento completo del barco
 *
 * El evaluador de disparos es un componente crítico para la mecánica principal
 * del juego, ya que implementa las reglas fundamentales de la batalla naval.
 */
export class ShotEvaluatorService {
  /**
   * Evalúa un disparo en coordenadas específicas contra todos los barcos del tablero.
   *
   * Este método realiza las siguientes operaciones:
   * 1. Itera a través de todos los barcos presentes en el tablero
   * 2. Verifica si alguna posición de barco coincide con las coordenadas del disparo
   * 3. Si encuentra coincidencia, marca la posición como impactada
   * 4. Verifica si todas las posiciones del barco están impactadas para determinar si fue hundido
   * 5. Retorna un objeto con el resultado detallado del disparo
   *
   * Los resultados posibles son:
   * - Impacto exitoso sin hundimiento: `{ hit: true }`
   * - Impacto exitoso con hundimiento: `{ hit: true, sunkShipId: number }`
   * - Disparo fallido (agua): `{ hit: false }`
   *
   * Nota: El método modifica directamente los objetos de barco proporcionados,
   * actualizando el estado de las posiciones impactadas y el estado de hundimiento.
   *
   * @param ships - Lista completa de barcos presentes en el tablero
   * @param row - Coordenada de fila (vertical) del disparo
   * @param col - Coordenada de columna (horizontal) del disparo
   * @returns Objeto ShotResult con el resultado detallado del disparo
   */
  static evaluate(ships: Ship[], row: number, col: number): ShotResult {
    // Iterar a través de todos los barcos en el tablero
    for (const ship of ships) {
      // Verificar cada posición del barco actual
      for (const pos of ship.positions) {
        // Condiciones para un impacto válido:
        // 1. Las coordenadas coinciden con la posición del barco
        // 2. La posición no ha sido impactada previamente
        // 3. El barco no está completamente hundido
        if (pos.row === row && pos.col === col && !pos.isHit && !ship.isSunk) {
          // Marcar la posición como impactada
          pos.isHit = true;

          // Verificar si todas las posiciones del barco han sido impactadas
          if (ship.positions.every((p) => p.isHit)) {
            // Si todas las posiciones fueron impactadas, marcar el barco como hundido
            ship.isSunk = true;
            // Retornar resultado de impacto con hundimiento, incluyendo ID del barco hundido
            return { hit: true, sunkShipId: ship.shipId };
          }

          // Retornar resultado de impacto sin hundimiento
          return { hit: true };
        }
      }
    }

    // Si no se encontró ninguna coincidencia, el disparo cayó al agua
    return { hit: false };
  }
}
