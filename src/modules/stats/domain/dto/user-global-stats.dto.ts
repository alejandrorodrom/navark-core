import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional } from 'class-validator';

export class UserGlobalStatsDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty()
  @IsInt()
  gamesPlayed: number;

  @ApiProperty()
  @IsInt()
  gamesWon: number;

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
  totalTurnsTaken: number;

  @ApiProperty()
  @IsInt()
  maxHitStreak: number;

  @ApiProperty()
  @IsInt()
  nuclearUsed: number;

  @ApiProperty({ required: false })
  @IsOptional()
  lastGameAt?: Date | null;
}
