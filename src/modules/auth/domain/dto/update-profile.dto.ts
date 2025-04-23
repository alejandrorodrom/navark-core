import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Comandante Azul' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ example: '#00ffaa' })
  @IsOptional()
  @IsString()
  @Matches(/^#(?:[0-9a-fA-F]{3}){1,2}$/, {
    message: 'Color debe ser un código hexadecimal válido',
  })
  color?: string;

  @ApiPropertyOptional({ example: 'nuevaClave123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
