import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../user/domain/repository/user.repository';
import { User } from '../../../user/domain/entity/user.entity';

@Injectable()
export class GetProfileUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: number): Promise<User | null> {
    return await this.userRepo.findById(userId);
  }
}
