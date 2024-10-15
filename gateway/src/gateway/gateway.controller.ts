import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { GatewayService } from './gateway.service';

@Controller('gateway')
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get('/find-user/:id')
  @HttpCode(200)
  async test(@Param('id') id: string) {
    return this.gatewayService.findUser(id);
  }
}
