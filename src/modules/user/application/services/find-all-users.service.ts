import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';

@Injectable()
export class FindAllUsersService {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
  ) {}

  execute() {
    return this.userRepo.findAll();
  }
}
