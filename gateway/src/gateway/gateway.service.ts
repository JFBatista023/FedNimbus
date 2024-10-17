import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { catchError, map } from 'rxjs';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh.dto';

@Injectable()
export class GatewayService {
  constructor(@Inject('AUTH_SERVICE') private auth_client: ClientKafka) {}

  async onModuleInit() {
    this.auth_client.subscribeToResponseOf('create_user');
    this.auth_client.subscribeToResponseOf('login_user');
    this.auth_client.subscribeToResponseOf('refresh_token');
    this.auth_client.subscribeToResponseOf('find_one_user');
    await this.auth_client.connect();
  }

  async createUser(payload: CreateUserDto) {
    return this.auth_client.send('create_user', payload).pipe(
      map(response => {
        return {
          success: true,
          data: response,
        };
      }),
      catchError(error => {
        throw new HttpException(
          { success: false, message: error.message },
          error.statusCode,
        );
      }),
    );
  }

  async loginUser(payload: LoginUserDto) {
    return this.auth_client.send('login_user', payload).pipe(
      map(response => {
        return {
          success: true,
          data: response,
        };
      }),
      catchError(error => {
        throw new HttpException(
          { success: false, message: error.message },
          error.statusCode,
        );
      }),
    );
  }

  async refreshToken(payload: RefreshTokenDto) {
    return this.auth_client.send('refresh-token', payload).pipe(
      map(response => {
        return {
          success: true,
          data: response,
        };
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
    return this.auth_client.send('find_one_user', id).pipe(
      map(response => {
        return {
          success: true,
          data: response,
        };
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
