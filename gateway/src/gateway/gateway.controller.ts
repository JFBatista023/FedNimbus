import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { Roles } from 'src/decorators/roles.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Get('/find-user/:id')
  @HttpCode(200)
  async findOneUser(@Param('id') id: string) {
    return this.gatewayService.findUser(id);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Get('/find-all')
  @HttpCode(200)
  async findAllUsers() {
    return this.gatewayService.findAllUsers();
  }

  @UseGuards(AuthGuard)
  @Put('/update-user/:id')
  @HttpCode(200)
  async updateUser(
    @Param('id') id: string,
    @Payload() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    const userIdFromToken = req.user.sub;
    return this.gatewayService.updateUser(userIdFromToken, id, updateUserDto);
  }

  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  @Get('/delete-user/:id')
  @HttpCode(201)
  async deleteUser(@Param('id') id: string) {
    return this.gatewayService.deleteUser(id);
  }

  @UseGuards(AuthGuard)
  @Get('/train')
  @HttpCode(200)
  async trainModel(@Request() req) {
    const userIdFromToken = req.user.sub;
    return this.gatewayService.trainModel(userIdFromToken);
  }
}
