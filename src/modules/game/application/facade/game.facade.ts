import { Injectable } from '@nestjs/common';
import { CreateGameUseCase } from '../use-cases/create-game.use-case';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';
import { MatchmakingUseCase } from '../use-cases/matchmaking.use-case';

/**
 * Fachada del módulo de juego.
 *
 * Expone una interfaz única hacia los controladores o gateways,
 * ocultando los detalles internos de los casos de uso.
 *
 * Esta fachada permite:
 * - Crear una partida manual con configuración personalizada.
 * - Ingresar al sistema de emparejamiento (matchmaking).
 */
@Injectable()
export class GameFacade {
  constructor(
    private readonly createGameService: CreateGameUseCase,
    private readonly matchmakingService: MatchmakingUseCase,
  ) {}

  /**
   * Crea una partida manual con parámetros definidos por el usuario.
   *
   * @param dto Objeto con configuración de la partida (modo, cantidad de jugadores, visibilidad, etc.)
   * @param userId ID del usuario que crea la partida
   * @returns Objeto `Game` con los datos de la partida creada
   */
  async createManualGame(dto: CreateGameDto, userId: number) {
    return this.createGameService.execute(dto, userId);
  }

  /**
   * Inicia el proceso de emparejamiento automático.
   *
   * Este método encuentra una partida compatible o crea una nueva si no existe ninguna.
   *
   * @param dto Preferencias del jugador para el matchmaking (modo, cantidad de jugadores, etc.)
   * @param userId ID del usuario que solicita entrar a matchmaking
   * @returns Objeto `Game` actualizado con el jugador unido o la nueva partida creada
   */
  async enterMatchmaking(dto: MatchmakingDto, userId: number) {
    return this.matchmakingService.execute(dto, userId);
  }
}
