// Definimos un tipo de ayuda para obtener las claves del GameEventPayloads
import { GameEventPayloads } from '../interfaces/game-event-payloads.interface';

export type EventKey = keyof GameEventPayloads;

/**
 * Tipo genérico para obtener el payload de un evento específico.
 * Solo funciona con eventos que están definidos en GameEventPayloads.
 */
export type EventPayload<T extends EventKey> = GameEventPayloads[T];
