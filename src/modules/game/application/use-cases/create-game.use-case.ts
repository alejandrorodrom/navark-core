import { BadRequestException, Injectable } from '@nestjs/common';
import { GameRepository } from '../../domain/repository/game.repository';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { GameResponseDto } from '../../domain/dto/game-response.dto';
import { GameMapper } from '../mapper/game.mapper';

/**
 * Caso de uso encargado de crear una nueva partida de juego manualmente.
 *
 * Aplica validaciones de configuración según el modo de juego y
 * delega la persistencia al repositorio.
 */
@Injectable()
export class CreateGameUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  /**
   * Ejecuta la creación de una nueva partida.
   *
   * Si el modo es "teams", valida que se haya proporcionado `teamCount`
   * entre 2 y 3. Luego crea la partida junto al primer jugador (el creador).
   *
   * @param dto Objeto con configuración de la partida (modo, dificultad, visibilidad, etc.)
   * @param userId ID del usuario que crea la partida
   * @returns Objeto `GameResponseDto` con los datos de la partida creada
   * @throws BadRequestException Si el modo es 'teams' pero el `teamCount` no es válido
   */
  async execute(dto: CreateGameDto, userId: number): Promise<GameResponseDto> {
    // Validar que si el modo es 'teams', la cantidad de equipos sea válida
    if (
      dto.mode === 'teams' &&
      (!dto.teamCount || dto.teamCount < 2 || dto.teamCount > 3)
    ) {
      throw new BadRequestException(
        'El modo por equipos requiere una cantidad válida de equipos (2 a 3).',
      );
    }

    // Crear la partida y registrar al jugador creador
    const game = await this.gameRepository.createGameWithPlayer(dto, userId);

    // Adaptar la respuesta a un DTO limpio para el cliente
    return GameMapper.toResponse(game);
  }
}
