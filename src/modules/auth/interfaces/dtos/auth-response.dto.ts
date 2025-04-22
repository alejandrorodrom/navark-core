import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../../user/interfaces/dtos/user-response.dto';

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  constructor(data: Partial<AuthResponseDto>) {
    Object.assign(this, data);
  }
}
