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
   * con valor numérico ≥ 2. Luego crea la partida junto al primer jugador (el creador).
   *
   * @param dto Objeto con configuración de la partida (modo, dificultad, visibilidad, etc.)
   * @param userId ID del usuario que crea la partida
   * @returns Objeto `GameResponseDto` con los datos de la partida creada
   * @throws BadRequestException Si el modo es 'teams' pero el `teamCount` no es válido
   */
  async execute(dto: CreateGameDto, userId: number): Promise<GameResponseDto> {
    this.validateTeamMode(dto.mode, dto.teamCount);

    const game = await this.gameRepository.createGameWithPlayer(dto, userId);

    return GameMapper.toResponse(game);
  }

  /**
   * Valida que si el modo es 'teams', se haya proporcionado un número válido de equipos.
   *
   * El número de equipos debe ser:
   * - Mínimo: 2 (para que tenga sentido un modo por equipos)
   * - Máximo: 5 (ya que en una partida de 6 jugadores, con 6 equipos sería individual)
   *
   * @param mode Modo de juego (individual o teams)
   * @param teamCount Número de equipos definidos en la configuración
   * @throws BadRequestException Si `teamCount` es inválido
   */
  private validateTeamMode(mode: string, teamCount?: number): void {
    if (mode !== 'teams') return;

    if (!teamCount || teamCount < 2 || teamCount > 5) {
      throw new BadRequestException(
        'El modo por equipos requiere entre 2 y 5 equipos. Con 6 equipos sería un modo individual.',
      );
    }
  }
}
