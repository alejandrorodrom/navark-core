import { Module } from '@nestjs/common';
import { CreateGuestUseCase } from './application/use-cases/create-guest.use-case';
import { JwtProviderModule } from '../../shared/jwt/jwt.module';
import { UserModule } from '../user/user.module';
import { IdentifyUserUseCase } from './application/use-cases/identify-user.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { AuthController } from './infrastructure/http/auth.controller';

@Module({
  imports: [JwtProviderModule, UserModule],
  controllers: [AuthController],
  providers: [
    CreateGuestUseCase,
    IdentifyUserUseCase,
    RefreshTokenUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
  ],
})
export class AuthModule {}
