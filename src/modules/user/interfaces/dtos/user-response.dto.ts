import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'player01' })
  username: string;

  @ApiProperty({ example: true })
  isGuest: boolean;

  @ApiProperty({ example: 'Capitán' })
  nickname: string | null;

  @ApiProperty({ example: '#00ffcc' })
  color: string | null;

  @ApiProperty({ example: '2025-04-20T17:00:00.000Z' })
  createdAt: Date;
}
