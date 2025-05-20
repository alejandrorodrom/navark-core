import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CreateGuestUseCase } from '../../application/use-cases/create-guest.use-case';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IdentifyUserUseCase } from '../../application/use-cases/identify-user.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { JwtAuthGuard } from '../../../../shared/jwt/jwt-auth.guard';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { AuthenticatedRequest } from '../../../../shared/jwt/jwt-request.interface';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { AuthResponseDto } from '../../domain/dto/auth-response.dto';
import { UserResponseDto } from '../../../user/domain/dto/user-response.dto';
import { IdentifyUserDto } from '../../domain/dto/identify-user.dto';
import { RefreshTokenDto } from '../../domain/dto/refresh-token.dto';
import { UpdateProfileDto } from '../../domain/dto/update-profile.dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly createGuest: CreateGuestUseCase,
    private readonly identifyUser: IdentifyUserUseCase,
    private readonly refreshTokenService: RefreshTokenUseCase,
    private readonly getProfileService: GetProfileUseCase,
    private readonly updateProfileService: UpdateProfileUseCase,
  ) {}

  @Post('guest')
  @ApiOperation({ summary: 'Crear sesión como invitado' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async createGuestUser(): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken } =
      await this.createGuest.execute();

    return new AuthResponseDto({
      accessToken,
      refreshToken,
      user: new UserResponseDto(user),
    });
  }

  @Post('identify')
  @ApiOperation({ summary: 'Identificar o registrar usuario' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  async identify(@Body() dto: IdentifyUserDto): Promise<AuthResponseDto> {
    const result = await this.identifyUser.execute(dto);
    return new AuthResponseDto({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: new UserResponseDto(result.user),
    });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { accessToken, user } = await this.refreshTokenService.execute(dto);

    return new AuthResponseDto({
      accessToken,
      refreshToken: dto.refreshToken,
      user: new UserResponseDto(user),
    });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(@Req() req: AuthenticatedRequest): Promise<UserResponseDto> {
    const user = await this.getProfileService.execute(req.user.id);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return new UserResponseDto(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const user = await this.updateProfileService.execute(req.user.id, dto);
    return new UserResponseDto(user);
  }
}
