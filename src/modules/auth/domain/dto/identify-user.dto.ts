import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IdentifyUserDto {
  @ApiProperty({ example: 'navarkPlayer' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'securePass123' })
  @IsString()
  @MinLength(6)
  password: string;
}
