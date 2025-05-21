import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../../../shared/jwt/jwt-payload.interface';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { RefreshTokenDto } from '../../domain/dto/refresh-token.dto';
import { User } from '../../../user/domain/entity/user.entity';

/**
 * Caso de uso responsable de validar un refresh token y emitir un nuevo access token.
 *
 * - Verifica que el refresh token sea válido y no haya expirado.
 * - Carga el usuario correspondiente al payload del token.
 * - Retorna un nuevo access token válido para el usuario.
 */
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepo: UserRepository,
  ) {}

  /**
   * Ejecuta el flujo de renovación de token.
   *
   * @param dto Objeto que contiene el refreshToken a validar.
   * @returns Un nuevo accessToken y el usuario correspondiente.
   *
   * @throws UnauthorizedException si el token es inválido o el usuario no existe.
   */
  async execute(dto: RefreshTokenDto): Promise<{
    accessToken: string;
    user: User;
  }> {
    try {
      // Paso 1: Verificar la validez del refresh token y extraer el payload
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);

      // Paso 2: Buscar el usuario correspondiente al ID (`sub`) del payload
      const user = await this.userRepo.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Paso 3: Firmar un nuevo access token con la información del usuario
      const newAccessToken = this.jwtService.sign(
        {
          sub: user.id,
          username: user.username,
          isGuest: user.isGuest,
        },
        {
          expiresIn: user.isGuest ? '6h' : '24h',
        },
      );

      // Paso 4: Retornar el nuevo token junto con los datos del usuario
      return {
        accessToken: newAccessToken,
        user,
      };
    } catch {
      // Captura cualquier error de verificación o firma y lanza excepción 401
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }
}
