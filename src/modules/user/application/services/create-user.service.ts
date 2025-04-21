import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { CreateUserDto } from '../../interfaces/dtos/create-user.dto';
import { BcryptPasswordService } from '../../infrastructure/bcrypt/bcrypt-password.service';

@Injectable()
export class CreateUserService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
    private readonly encrypter: BcryptPasswordService,
  ) {}

  async execute(dto: CreateUserDto) {
    const password = dto.password
      ? await this.encrypter.hash(dto.password)
      : null;

    return this.userRepo.create({
      username: dto.username,
      isGuest: dto.isGuest ?? true,
      password,
      nickname: dto.nickname,
      color: dto.color,
    });
  }
}
