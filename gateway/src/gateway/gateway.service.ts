import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { catchError, map } from 'rxjs';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class GatewayService {
  constructor(
    @Inject('AUTH_SERVICE') private auth_client: ClientKafka,
    @Inject('TRAINING_SERVICE') private training_client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.auth_client.subscribeToResponseOf('create_user');
    this.auth_client.subscribeToResponseOf('login_user');
    this.auth_client.subscribeToResponseOf('refresh_token');
    this.auth_client.subscribeToResponseOf('find_one_user');
    this.auth_client.subscribeToResponseOf('find_all_users');
    this.auth_client.subscribeToResponseOf('update_user');
    this.auth_client.subscribeToResponseOf('delete_user');
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
    return this.auth_client.send('refresh_token', payload).pipe(
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

  async findAllUsers() {
    return this.auth_client.send('find_all_users', {}).pipe(
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

  async updateUser(
    idFromToken: string,
    id: string,
    updateUserDto: UpdateUserDto,
  ) {
    const payload = { idFromToken, id, ...updateUserDto };
    return this.auth_client.send('update_user', payload).pipe(
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

  async deleteUser(id: string) {
    return this.auth_client.send('delete_user', id).pipe(
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

  async trainModel(idFromToken: string) {
    const payload = { idFromToken };
    return this.training_client.emit('training_requests', payload);
  }
}
