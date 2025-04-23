import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Matches, MinLength } from 'class-validator';

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @IsString()
  @MinLength(3)
  @ApiProperty()
  username: string;

  @IsBoolean()
  @ApiProperty()
  isGuest: boolean;

  @IsString()
  @ApiProperty()
  nickname: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color debe ser un código hexadecimal válido',
  })
  @ApiProperty()
  color: string;

  @ApiProperty()
  createdAt: Date;

  constructor(user: {
    id: number;
    username: string;
    isGuest: boolean;
    nickname: string;
    color: string;
    createdAt: Date;
  }) {
    this.id = user.id;
    this.username = user.username;
    this.isGuest = user.isGuest;
    this.nickname = user.nickname;
    this.color = user.color;
    this.createdAt = user.createdAt;
  }
}
