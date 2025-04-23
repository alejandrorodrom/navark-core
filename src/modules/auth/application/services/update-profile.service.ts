import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { UpdateProfileDto } from '../../domain/dtos/update-profile.dto';
import { BcryptPasswordService } from '../../../user/infrastructure/bcrypt/bcrypt-password.service';
import { User } from '../../../user/domain/entities/user.entity';

@Injectable()
export class UpdateProfileService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
    private readonly bcrypt: BcryptPasswordService,
  ) {}

  async execute(userId: number, dto: UpdateProfileDto): Promise<User> {
    const updates: {
      nickname?: string | null;
      color?: string | null;
      password?: string | null;
    } = {
      nickname: dto.nickname ?? null,
      color: dto.color ?? null,
    };

    if (dto.password) {
      updates.password = await this.bcrypt.hash(dto.password);
    }

    return await this.userRepo.update(userId, updates);
  }
}
