import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { User } from '../../../user/domain/entity/user.entity';

/**
 * Caso de uso para obtener el perfil del usuario autenticado.
 *
 * Encapsula el acceso al repositorio de usuarios con el fin de
 * consultar los datos completos del usuario a partir de su ID.
 */
@Injectable()
export class GetProfileUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  /**
   * Ejecuta la consulta del usuario por su ID.
   *
   * @param userId ID del usuario autenticado
   * @returns El objeto `User` si existe, o `null` si no se encuentra
   */
  async execute(userId: number): Promise<User | null> {
    // Consulta al repositorio de usuarios por ID
    return await this.userRepo.findById(userId);
  }
}
