import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MatchmakingDto {
  @IsOptional()
  @IsEnum(['individual', 'teams'])
  @ApiPropertyOptional({
    enum: ['individual', 'teams'],
    description: 'Modo de juego deseado',
  })
  mode?: 'individual' | 'teams';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(6)
  @ApiPropertyOptional({
    minimum: 2,
    maximum: 6,
    description: 'Número máximo de jugadores deseado',
  })
  maxPlayers?: number;
}
