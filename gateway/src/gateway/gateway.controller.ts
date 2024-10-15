import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { GatewayService } from './gateway.service';

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('/create-user')
  @HttpCode(201)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.gatewayService.createUser(createUserDto);
  }

  @Get('/find-user/:id')
  @HttpCode(200)
  async findOne(@Param('id') id: string) {
    return this.gatewayService.findUser(id);
  }
}
