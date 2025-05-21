import { Game } from '../../../../prisma/prisma.types';
import { GameResponseDto } from '../../domain/dto/game-response.dto';

/**
 * Clase encargada de transformar entidades crudas del modelo `Game` (de la base de datos)
 * en DTOs utilizados para respuesta HTTP (`GameResponseDto`).
 */
export class GameMapper {
  /**
   * Transforma una instancia de `Game` (Prisma) a `GameResponseDto`.
   *
   * Esta conversión es usada para exponer solo los campos necesarios
   * al cliente (limpieza del modelo para la capa pública).
   *
   * @param game Objeto `Game` proveniente de la base de datos
   * @returns DTO con los campos públicos necesarios para respuesta
   */
  static toResponse(game: Game): GameResponseDto {
    return {
      id: game.id,

      // El nombre de la sala solo se expone si está definido
      name: game.name ?? undefined,

      // Código de acceso (si se definió, solo en salas privadas)
      accessCode: game.accessCode ?? undefined,

      isPublic: game.isPublic,
      isMatchmaking: game.isMatchmaking,
      maxPlayers: game.maxPlayers,

      // El modo de juego siempre es 'individual' o 'teams'
      mode: game.mode as 'individual' | 'teams',

      // La dificultad se tipa explícitamente
      difficulty: game.difficulty as 'easy' | 'medium' | 'hard',

      // Se incluye `teamCount` solo si fue configurado
      teamCount: game.teamCount ?? undefined,

      status: game.status,
      createdAt: game.createdAt,
    };
  }
}
