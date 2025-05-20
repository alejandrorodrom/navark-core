import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BcryptPasswordService } from '../../../user/infrastructure/bcrypt/bcrypt-password.service';
import { IdentifyUserDto } from '../../domain/dto/identify-user.dto';
import { User } from '../../../user/domain/entity/user.entity';
import { UserRepository } from '../../../user/domain/repository/user.repository';

@Injectable()
export class IdentifyUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
    private readonly bcrypt: BcryptPasswordService,
  ) {}

  async execute(dto: IdentifyUserDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }> {
    const existing = await this.userRepo.findByUsername(dto.username);

    if (existing) {
      if (!existing.password) {
        throw new BadRequestException(
          'Usuario no puede iniciar sesión manualmente',
        );
      }

      const isValid = await this.bcrypt.compare(
        dto.password,
        existing.password,
      );
      if (!isValid) throw new BadRequestException('Contraseña incorrecta');

      return this.generateTokens(existing);
    }

    // No existe → registrar
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
          .padStart(6, '0'),
    });

    return this.generateTokens(user);
  }

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
