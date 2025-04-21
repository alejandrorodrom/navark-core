import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateUserService } from '../../application/services/create-user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UpdateUserService } from '../../application/services/update-user.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserResponseDto } from '../dtos/user-response.dto';
import { FindOneUserService } from '../../application/services/find-one-user.service';

@Controller('users')
export class UserController {
  constructor(
    private readonly createUser: CreateUserService,
    private readonly updateUser: UpdateUserService,
    private readonly findOneUser: FindOneUserService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  async create(@Body() dto: CreateUserDto) {
    return this.createUser.execute(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('id') id: string) {
    return this.findOneUser.execute(Number(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar usuario por ID' })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado correctamente',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.updateUser.execute(Number(id), dto);
  }
}
