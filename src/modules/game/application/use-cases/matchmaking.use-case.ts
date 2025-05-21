import { Injectable } from '@nestjs/common';
import { GameRepository } from '../../domain/repository/game.repository';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { GameResponseDto } from '../../domain/dto/game-response.dto';
import { GameMapper } from '../mapper/game.mapper';

/**
 * Caso de uso encargado de ingresar a un sistema de emparejamiento automático.
 *
 * El servicio busca una partida compatible disponible para el jugador actual.
 * Si no encuentra ninguna, crea una nueva automáticamente.
 */
@Injectable()
export class MatchmakingUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  /**
   * Ejecuta el emparejamiento para el jugador dado.
   *
   * Busca una partida existente que coincida con el criterio del jugador.
   * Si no hay coincidencia, crea una nueva y lo añade como primer jugador.
   *
   * @param dto Datos de entrada del jugador para emparejamiento (modo, dificultad, etc.)
   * @param userId ID del jugador que desea entrar a una partida
   * @returns Detalle de la partida a la que fue asignado o creada
   */
  async execute(dto: MatchmakingDto, userId: number): Promise<GameResponseDto> {
    const game = await this.gameRepository.findOrCreateMatch(dto, userId);
    return GameMapper.toResponse(game);
  }
}
