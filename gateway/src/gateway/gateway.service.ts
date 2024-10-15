import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, map } from 'rxjs';

@Injectable()
export class GatewayService {
  constructor(@Inject('AUTH_SERVICE') private client: ClientProxy) {}

  async findUser(id: string) {
    return this.client.send('find_one_user', id).pipe(
      map(response => {
        return {
          success: true,
          data: response,
        }; // Refactor
      }),
      catchError(error => {
        throw new HttpException(
          { success: false, message: error.message },
          error.statusCode,
        );
      }),
    );
  }
}
