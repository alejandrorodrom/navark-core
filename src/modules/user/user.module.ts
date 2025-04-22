import { Module } from '@nestjs/common';
import { PrismaUserRepository } from './infrastructure/prisma/user.prisma.repository';
import { BcryptPasswordService } from './infrastructure/bcrypt/bcrypt-password.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
    BcryptPasswordService,
  ],
  exports: ['UserRepository', BcryptPasswordService],
})
export class UserModule {}
