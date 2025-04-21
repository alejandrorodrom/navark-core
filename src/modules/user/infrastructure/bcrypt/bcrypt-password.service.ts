import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class BcryptPasswordService {
  private readonly saltRounds: number = 10;

  async hash(password: string): Promise<string> {
    return (await bcrypt.hash(password, this.saltRounds)) + '';
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(plain, hash);
  }
}
