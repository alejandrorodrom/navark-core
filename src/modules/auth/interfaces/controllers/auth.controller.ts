import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CreateGuestService } from '../../application/services/create-guest.service';
import { AuthResponseDto } from '../dtos/auth-response.dto';
import { UserResponseDto } from '../../../user/interfaces/dtos/user-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IdentifyUserDto } from '../dtos/identify-user.dto';
import { IdentifyUserService } from '../../application/services/identify-user.service';
import { RefreshTokenService } from '../../application/services/refresh-token.service';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { JwtAuthGuard } from '../../infrastructure/jwt/jwt-auth.guard';
import { GetProfileService } from '../../application/services/get-profile.service';
import { AuthenticatedRequest } from '../../infrastructure/jwt/jwt-request.interface';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { UpdateProfileService } from '../../application/services/update-profile.service';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly createGuest: CreateGuestService,
    private readonly identifyUser: IdentifyUserService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly getProfileService: GetProfileService,
    private readonly updateProfileService: UpdateProfileService,
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
