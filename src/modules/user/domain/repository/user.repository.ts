import { User } from '../entity/user.entity';

export abstract class UserRepository {
  abstract create(data: {
    username: string;
    isGuest?: boolean;
    password?: string | null;
    nickname: string;
    color: string;
  }): Promise<User>;

  abstract findByUsername(username: string): Promise<User | null>;

  abstract findById(id: number): Promise<User | null>;

  abstract update(
    id: number,
    data: {
      password?: string | null;
      nickname?: string | null;
      color?: string | null;
    },
  ): Promise<User>;
}
