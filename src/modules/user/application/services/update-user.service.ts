import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UpdateUserDto } from '../../interfaces/dtos/update-user.dto';
import { User } from '../../domain/entities/user.entity';
import { BcryptPasswordService } from '../../infrastructure/bcrypt/bcrypt-password.service';

@Injectable()
export class UpdateUserService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
    private readonly encrypter: BcryptPasswordService,
  ) {}

  async execute(userId: number, dto: UpdateUserDto): Promise<User> {
    const password = dto.password
      ? await this.encrypter.hash(dto.password)
      : undefined;

    return this.userRepo.update(userId, {
      password,
      nickname: dto.nickname,
      color: dto.color,
    });
  }
}
