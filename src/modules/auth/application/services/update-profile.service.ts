import { Injectable } from '@nestjs/common';
import { BcryptPasswordService } from '../../../user/infrastructure/bcrypt/bcrypt-password.service';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { UpdateProfileDto } from '../../domain/dto/update-profile.dto';
import { User } from '../../../user/domain/entity/user.entity';

@Injectable()
export class UpdateProfileService {
  constructor(
    private readonly userRepo: UserRepository,
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
