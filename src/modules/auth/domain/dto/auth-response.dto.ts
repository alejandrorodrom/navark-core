import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '../../../user/domain/dto/user-response.dto';

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
