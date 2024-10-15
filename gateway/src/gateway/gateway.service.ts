import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, map } from 'rxjs';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class GatewayService {
  constructor(@Inject('AUTH_SERVICE') private client: ClientProxy) {}

  async createUser(payload: CreateUserDto) {
    return this.client.send('create_user', payload).pipe(
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
