import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, map, of } from 'rxjs';

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
        };
      }),
      catchError(error => {
        return of({
          success: false,
          message: error.message || 'An error occurred',
          statusCode: error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
        });
      }),
    );
  }
}
