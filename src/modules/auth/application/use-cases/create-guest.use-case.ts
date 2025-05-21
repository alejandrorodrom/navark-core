import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { User } from '../../../user/domain/entity/user.entity';

/**
 * Caso de uso para crear un usuario invitado.
 *
 * Este proceso:
 * - Genera un identificador único de invitado
 * - Registra al usuario como invitado en el sistema
 * - Genera un accessToken y refreshToken firmados con JWT
 */
@Injectable()
export class CreateGuestUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Ejecuta la creación de un usuario invitado con sesión JWT.
   *
   * @returns Un objeto con el accessToken, refreshToken y el usuario creado.
   */
  async execute(): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }> {
    // Paso 1: Generar un timestamp único para evitar colisiones en username y nickname
    const timestamp = Date.now();
    const username = `Invitado ${timestamp}`;

    // Paso 2: Crear el usuario invitado en el repositorio con valores por defecto
    const user = await this.userRepo.create({
      username,
      isGuest: true,
      nickname: `Invitado-${timestamp}`,
      color:
        '#' +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0'), // genera un color hexadecimal aleatorio
    });

    // Paso 3: Construir el payload que será firmado en los tokens JWT
    const payload = {
      sub: user.id,
      username: user.username,
      isGuest: user.isGuest,
      nickname: user.nickname,
      color: user.color,
    };

    // Paso 4: Generar el access token con expiración de 6 horas
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '6h',
    });

    // Paso 5: Generar el refresh token con expiración de 7 días
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    // Paso 6: Retornar los tokens junto con el usuario
    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
