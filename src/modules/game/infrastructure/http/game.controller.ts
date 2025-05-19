import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { GameFacade } from '../../application/facade/game.facade';
import { JwtAuthGuard } from '../../../../shared/jwt/jwt-auth.guard';
import { CreateGameDto } from '../../domain/dto/create-game.dto';
import { UserId } from '../../../../shared/decorators/user-id.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GameResponseDto } from '../../domain/dto/game-response.dto';
import { MatchmakingDto } from '../../domain/dto/matchmaking.dto';

@ApiTags('Juego')
@ApiBearerAuth()
@Controller('games')
export class GameController {
  constructor(private readonly gameFacade: GameFacade) {}

  @UseGuards(JwtAuthGuard)
  @Post('manual')
  @ApiBearerAuth('access-token')
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

  @UseGuards(JwtAuthGuard)
  @Post('matchmaking')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unirse a una partida por matchmaking' })
  @ApiBody({ type: MatchmakingDto })
  @ApiResponse({ status: 201, type: GameResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  createByMatchmaking(@Body() dto: MatchmakingDto, @UserId() userId: number) {
    return this.gameFacade.enterMatchmaking(dto, userId);
  }
}
