import { Module } from '@nestjs/common';
import { AuthController } from './interfaces/controllers/auth.controller';
import { CreateGuestService } from './application/services/create-guest.service';
import { JwtProviderModule } from './infrastructure/jwt/jwt.module';
import { UserModule } from '../user/user.module';
import { IdentifyUserService } from './application/services/identify-user.service';
import { RefreshTokenService } from './application/services/refresh-token.service';
import { GetProfileService } from './application/services/get-profile.service';
import { UpdateProfileService } from './application/services/update-profile.service';

@Module({
  imports: [JwtProviderModule, UserModule],
  controllers: [AuthController],
  providers: [
    CreateGuestService,
    IdentifyUserService,
    RefreshTokenService,
    GetProfileService,
    UpdateProfileService,
  ],
})
export class AuthModule {}
