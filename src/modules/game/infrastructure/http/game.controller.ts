import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { GameFacade } from '../../application/facade/game.facade';
import { JwtAuthGuard } from '../../../auth/infrastructure/jwt/jwt-auth.guard';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { UserId } from '../../../auth/decorators/user-id.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GameResponseDto } from '../../domain/dto/game-response.dto';

@ApiTags('Juego')
@ApiBearerAuth()
@Controller('games')
export class GameController {
  constructor(private readonly gameFacade: GameFacade) {}

  @UseGuards(JwtAuthGuard)
  @Post('manual')
  @ApiOperation({ summary: 'Crea una partida manual' })
  @ApiBody({ type: CreateGameDto })
  @ApiResponse({
    status: 201,
    type: GameResponseDto,
    description: 'Partida creada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación o parámetros inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado',
  })
  createManualGame(@Body() dto: CreateGameDto, @UserId() userId: number) {
    return this.gameFacade.createManualGame(dto, userId);
  }
}
