import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../../../../shared/jwt/jwt-payload.interface';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { RefreshTokenDto } from '../../domain/dto/refresh-token.dto';
import { User } from '../../../user/domain/entity/user.entity';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepo: UserRepository,
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
