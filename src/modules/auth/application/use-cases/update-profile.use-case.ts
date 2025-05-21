import { Injectable } from '@nestjs/common';
import { BcryptPasswordService } from '../../../user/infrastructure/bcrypt/bcrypt-password.service';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { UpdateProfileDto } from '../../domain/dto/update-profile.dto';
import { User } from '../../../user/domain/entity/user.entity';

/**
 * Caso de uso encargado de actualizar el perfil de un usuario autenticado.
 *
 * Permite:
 * - Cambiar el nickname
 * - Cambiar el color del perfil
 * - Cambiar la contraseña (opcional)
 */
@Injectable()
export class UpdateProfileUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly bcrypt: BcryptPasswordService,
  ) {}

  /**
   * Ejecuta la actualización del perfil del usuario.
   *
   * @param userId ID del usuario autenticado
   * @param dto Objeto con los campos a actualizar (nickname, color, password)
   * @returns El objeto `User` actualizado
   */
  async execute(userId: number, dto: UpdateProfileDto): Promise<User> {
    // Paso 1: Inicializar el objeto de actualización con valores opcionales
    const updates: {
      nickname?: string | null;
      color?: string | null;
      password?: string | null;
    } = {
      nickname: dto.nickname ?? null,
      color: dto.color ?? null,
    };

    // Paso 2: Si se proporciona una nueva contraseña, se hashea antes de guardar
    if (dto.password) {
      updates.password = await this.bcrypt.hash(dto.password);
    }

    // Paso 3: Ejecutar la actualización en el repositorio y retornar el nuevo estado del usuario
    return await this.userRepo.update(userId, updates);
  }
}
