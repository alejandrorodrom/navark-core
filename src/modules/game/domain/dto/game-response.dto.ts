import { ApiProperty } from '@nestjs/swagger';

export class GameResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ required: false })
  name?: string;

  @ApiProperty({ required: false })
  accessCode?: string;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isMatchmaking: boolean;

  @ApiProperty()
  maxPlayers: number;

  @ApiProperty()
  mode: 'individual' | 'teams';

  @ApiProperty({ required: false })
  teamCount?: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
