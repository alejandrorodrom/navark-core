import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'nuevoPassword123' })
  password?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Capitán Verde' })
  nickname?: string | null;

  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color debe ser un código hexadecimal válido',
  })
  @ApiPropertyOptional({ example: '#33cc33' })
  color?: string | null;
}
