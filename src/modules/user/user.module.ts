import { Module } from '@nestjs/common';
import { UserController } from './interfaces/controllers/user.controller';
import { CreateUserService } from './application/services/create-user.service';
import { PrismaUserRepository } from './infrastructure/prisma/user.prisma.repository';
import { BcryptPasswordService } from './infrastructure/bcrypt/bcrypt-password.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    CreateUserService,
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
    BcryptPasswordService,
  ],
})
export class UserModule {}
