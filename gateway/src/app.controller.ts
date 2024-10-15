import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, map } from 'rxjs';

@Controller('auth')
export class AppController {
  constructor(@Inject('AUTH_SERVICE') private client: ClientProxy) {}

  @Get('/test')
  async test() {
    return this.client.send('find_one_user', '0').pipe(
      map(response => {
        return {
          success: true,
          data: response,
        }; // Refactor
      }),
      catchError(error => {
        throw new HttpException(error.message, error.status);
      }),
    );
  }
}
