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
    password?: string;
    nickname: string;
    color: string;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        isGuest: data.isGuest ?? false,
        nickname: data.nickname,
        color: data.color,
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

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    return user
      ? new User({
          id: user.id,
          username: user.username,
          isGuest: user.isGuest,
          password: user.password,
          nickname: user.nickname,
          color: user.color,
          createdAt: user.createdAt,
        })
      : null;
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user
      ? new User({
          id: user.id,
          username: user.username,
          isGuest: user.isGuest,
          password: user.password,
          nickname: user.nickname,
          color: user.color,
          createdAt: user.createdAt,
        })
      : null;
  }

  async update(
    id: number,
    data: {
      password?: string | null;
      nickname?: string | null;
      color?: string | null;
    },
  ): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        password: data.password ?? undefined,
        nickname: data.nickname ?? undefined,
        color: data.color ?? undefined,
      },
    });

    return new User({
      id: user.id,
      username: user.username,
      isGuest: user.isGuest,
      password: user.password,
      nickname: user.nickname,
      color: user.color,
      createdAt: user.createdAt,
    });
  }
}
