import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header not found.');
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = this.jwtService.verify(token);

      if (roles && roles.length > 0 && !roles.includes(decoded.role)) {
        throw new UnauthorizedException(
          'User does not have the required role.',
        );
      }

      request.user = decoded;
      return true;
    } catch (err) {
      throw new UnauthorizedException(err.message || 'Invalid token.');
    }
  }
}
