import { Module } from '@nestjs/common';
import { UserController } from './interfaces/controllers/user.controller';
import { CreateUserService } from './application/services/create-user.service';
import { PrismaUserRepository } from './infrastructure/prisma/user.prisma.repository';
import { UpdateUserService } from './application/services/update-user.service';
import { BcryptPasswordService } from './infrastructure/bcrypt/bcrypt-password.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FindOneUserService } from './application/services/find-one-user.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserController],
  providers: [
    CreateUserService,
    FindOneUserService,
    UpdateUserService,
    {
      provide: 'UserRepository',
      useClass: PrismaUserRepository,
    },
    BcryptPasswordService,
  ],
})
export class UserModule {}
