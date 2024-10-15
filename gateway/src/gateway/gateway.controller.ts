import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { GatewayService } from './gateway.service';

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('/create-user')
  @HttpCode(201)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.gatewayService.createUser(createUserDto);
  }

  @Post('/login-user')
  @HttpCode(200)
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.gatewayService.loginUser(loginUserDto);
  }

  @Post('/refresh-token')
  @HttpCode(200)
  async refreshToken(@Payload() refreshTokenDto: RefreshTokenDto) {
    return this.gatewayService.refreshToken(refreshTokenDto);
  }

  @Get('/find-user/:id')
  @HttpCode(200)
  async findOne(@Param('id') id: string) {
    return this.gatewayService.findUser(id);
  }
}
