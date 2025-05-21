import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BcryptPasswordService } from '../../../user/infrastructure/bcrypt/bcrypt-password.service';
import { IdentifyUserDto } from '../../domain/dto/identify-user.dto';
import { User } from '../../../user/domain/entity/user.entity';
import { UserRepository } from '../../../user/domain/repository/user.repository';

/**
 * Caso de uso que permite identificar a un usuario por su nombre de usuario y contraseña.
 *
 * Si el usuario ya existe:
 * - Se valida su contraseña.
 * - Se generan tokens JWT si la autenticación es exitosa.
 *
 * Si el usuario no existe:
 * - Se crea uno nuevo con la contraseña proporcionada.
 * - Se genera el JWT automáticamente como parte del registro.
 */
@Injectable()
export class IdentifyUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    private readonly bcrypt: BcryptPasswordService,
  ) {}

  /**
   * Ejecuta la lógica de identificación o registro del usuario.
   *
   * @param dto Contiene `username` y `password` del usuario.
   * @returns Objeto con `accessToken`, `refreshToken` y el `User` identificado o creado.
   *
   * @throws BadRequestException si el usuario existe pero no tiene contraseña o la contraseña es inválida.
   */
  async execute(dto: IdentifyUserDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }> {
    // Paso 1: Buscar si el usuario ya existe por su username
    const existing = await this.userRepo.findByUsername(dto.username);

    if (existing) {
      // Paso 2: Validar si el usuario puede autenticarse manualmente
      if (!existing.password) {
        throw new BadRequestException(
          'Usuario no puede iniciar sesión manualmente',
        );
      }

      // Paso 3: Verificar que la contraseña proporcionada sea válida
      const isValid = await this.bcrypt.compare(
        dto.password,
        existing.password,
      );

      if (!isValid) {
        throw new BadRequestException('Contraseña incorrecta');
      }

      // Paso 4: Generar tokens para el usuario existente autenticado
      return this.generateTokens(existing);
    }

    // Paso 5: Si no existe, se procede con el registro automático
    const hashed = await this.bcrypt.hash(dto.password);

    const user = await this.userRepo.create({
      username: dto.username,
      password: hashed,
      isGuest: false,
      nickname: dto.username,
      color:
        '#' +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0'), // Color aleatorio en formato hexadecimal
    });

    // Paso 6: Generar tokens para el nuevo usuario registrado
    return this.generateTokens(user);
  }

  /**
   * Genera el accessToken y refreshToken JWT para el usuario.
   *
   * @param user Objeto `User` ya autenticado o recién creado
   * @returns Tokens de acceso y refresco junto con los datos del usuario
   */
  private generateTokens(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
      isGuest: user.isGuest,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: user.isGuest ? '6h' : '24h',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }
}
