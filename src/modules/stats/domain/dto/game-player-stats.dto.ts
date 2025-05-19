import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsString } from 'class-validator';

export class GamePlayerStatsDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsString()
  nickname: string;

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
  @IsBoolean()
  wasWinner: boolean;

  @ApiProperty()
  @IsInt()
  turnsTaken: number;

  @ApiProperty()
  @IsInt()
  shipsRemaining: number;

  @ApiProperty()
  @IsBoolean()
  wasEliminated: boolean;

  @ApiProperty()
  @IsInt()
  hitStreak: number;

  @ApiProperty()
  @IsBoolean()
  lastShotWasHit: boolean;
}
