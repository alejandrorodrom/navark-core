import { Injectable, Inject } from '@nestjs/common';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { User } from '../../../user/domain/entities/user.entity';

@Injectable()
export class GetProfileService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  async execute(userId: number): Promise<User | null> {
    return await this.userRepo.findById(userId);
  }
}
