import { Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    username: string;
    isGuest?: boolean;
    password?: string | null;
    nickname?: string | null;
    color?: string | null;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        isGuest: data.isGuest ?? false,
        nickname: data.nickname ?? null,
        color: data.color ?? null,
        password: data.password ?? null,
      },
    });

    return new User({
      id: user.id,
      username: user.username,
      isGuest: user.isGuest,
      createdAt: user.createdAt,
      nickname: user.nickname,
      color: user.color,
      password: user.password,
    });
  }
}
