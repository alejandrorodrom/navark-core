import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @ApiProperty({ example: 'jugador123' })
  username: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  isGuest?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'password123' })
  password?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Comandante Azul' })
  nickname?: string | null;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color debe ser un código hexadecimal válido',
  })
  @ApiPropertyOptional({ example: '#00ffcc' })
  color?: string | null;
}
