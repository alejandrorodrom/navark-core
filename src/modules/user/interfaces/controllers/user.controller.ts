import { Body, Controller, Post } from '@nestjs/common';
import { CreateUserService } from '../../application/services/create-user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('users')
export class UserController {
  constructor(private readonly createUser: CreateUserService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  async create(@Body() dto: CreateUserDto) {
    return this.createUser.execute(dto);
  }
}
