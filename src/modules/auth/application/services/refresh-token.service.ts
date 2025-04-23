import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenDto } from '../../domain/dtos/refresh-token.dto';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { User } from '../../../user/domain/entities/user.entity';
import { JwtPayload } from '../../infrastructure/jwt/jwt-payload.interface';

@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async execute(dto: RefreshTokenDto): Promise<{
    accessToken: string;
    user: User;
  }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(dto.refreshToken);
      const user = await this.userRepo.findById(payload.sub);

      if (!user) throw new UnauthorizedException('Usuario no encontrado');

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

      return {
        accessToken: newAccessToken,
        user,
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }
}
