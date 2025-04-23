import { User } from '../entities/user.entity';

export interface UserRepository {
  create(data: {
    username: string;
    isGuest?: boolean;
    password?: string | null;
    nickname: string;
    color: string;
  }): Promise<User>;

  findByUsername(username: string): Promise<User | null>;

  findById(id: number): Promise<User | null>;

  update(
    id: number,
    data: {
      password?: string | null;
      nickname?: string | null;
      color?: string | null;
    },
  ): Promise<User>;
}
