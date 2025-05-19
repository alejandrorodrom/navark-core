import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsNumber, IsDate } from 'class-validator';

export class PlayerGameHistoryDto {
  @ApiProperty()
  @IsInt()
  gameId: number;

  @ApiProperty()
  @IsString()
  gameMode: string;

  @ApiProperty()
  @IsDate()
  playedAt: Date;

  @ApiProperty()
  @IsBoolean()
  wasWinner: boolean;

  @ApiProperty()
  @IsInt()
  totalShots: number;

  @ApiProperty()
  @IsInt()
  successfulShots: number;

  @ApiProperty()
  @IsNumber()
  accuracy: number;

  @ApiProperty()
  @IsInt()
  shipsSunk: number;

  @ApiProperty()
  @IsInt()
  hitStreak: number;
}
