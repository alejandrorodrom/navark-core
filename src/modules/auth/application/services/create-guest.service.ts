import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { User } from '../../../user/domain/entity/user.entity';

@Injectable()
export class CreateGuestService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(): Promise<{
    accessToken: string;
    refreshToken: string;
    user: User;
  }> {
    const timestamp = Date.now();
    const username = `Invitado ${timestamp}`;

    const user = await this.userRepo.create({
      username,
      isGuest: true,
      nickname: `Invitado-${timestamp}`,
      color:
        '#' +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0'),
    });

    const payload = {
      sub: user.id,
      username: user.username,
      isGuest: user.isGuest,
      nickname: user.nickname,
      color: user.color,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '6h',
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
