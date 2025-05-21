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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateGuestUseCase } from '../../application/use-cases/create-guest.use-case';
import { IdentifyUserUseCase } from '../../application/use-cases/identify-user.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { JwtAuthGuard } from '../../../../shared/jwt/jwt-auth.guard';
import { AuthenticatedRequest } from '../../../../shared/jwt/jwt-request.interface';
import { AuthResponseDto } from '../../domain/dto/auth-response.dto';
import { UserResponseDto } from '../../../user/domain/dto/user-response.dto';
import { IdentifyUserDto } from '../../domain/dto/identify-user.dto';
import { RefreshTokenDto } from '../../domain/dto/refresh-token.dto';
import { UpdateProfileDto } from '../../domain/dto/update-profile.dto';

/**
 * Controlador encargado de manejar todas las rutas relacionadas a autenticación.
 *
 * Este controlador ofrece soporte para:
 * - Crear una sesión como usuario invitado.
 * - Identificar o registrar un usuario con credenciales.
 * - Renovar el access token usando un refresh token válido.
 * - Consultar y actualizar el perfil del usuario autenticado.
 */
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

  /**
   * Crea una nueva sesión temporal como invitado.
   * Este usuario no requiere registro previo ni contraseña.
   *
   * @returns Objeto con access token, refresh token y datos del usuario invitado.
   */
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

  /**
   * Identifica un usuario registrado o lo registra si no existe.
   * El acceso se realiza por username y password.
   *
   * @param dto Datos de identificación (username y password)
   * @returns Objeto con access token, refresh token y datos del usuario.
   */
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

  /**
   * Renueva el access token a partir de un refresh token válido.
   *
   * @param dto Contiene el refresh token previamente emitido.
   * @returns Objeto con un nuevo access token y los datos del usuario.
   */
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

  /**
   * Devuelve los datos del usuario autenticado que realiza la petición.
   *
   * @param req Objeto de request decorado con `user` desde el JWT.
   * @throws UnauthorizedException si el usuario no existe en base de datos.
   * @returns Objeto `UserResponseDto` con los datos públicos del perfil.
   */
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

  /**
   * Actualiza los datos del usuario autenticado (nickname, color o contraseña).
   *
   * @param req Objeto de request decorado con `user` desde el JWT.
   * @param dto Datos del perfil a actualizar.
   * @returns Objeto `UserResponseDto` con los datos actualizados.
   */
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
