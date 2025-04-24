import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGameDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Nombre opcional de la partida (debe ser único)',
  })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Contraseña opcional para partida privada',
  })
  accessCode?: string;

  @IsBoolean()
  @ApiProperty({ description: 'Indica si la sala será pública' })
  isPublic: boolean;

  @IsInt()
  @Min(2)
  @Max(6)
  @ApiProperty({
    minimum: 2,
    maximum: 6,
    description: 'Cantidad máxima de jugadores',
  })
  maxPlayers: number;

  @IsEnum(['individual', 'teams'])
  @ApiProperty({ enum: ['individual', 'teams'], description: 'Modo de juego' })
  mode: 'individual' | 'teams';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(3)
  @ApiProperty({
    required: false,
    description: 'Cantidad de equipos (Solo si es en equipo)',
  })
  teamCount?: number;
}
