import { ClientsModule, Transport } from '@nestjs/microservices';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { configDotenv } from 'dotenv';
import { jwtConstants } from 'src/infra/auth/constants';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';

configDotenv();

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'gateway',
            brokers: [process.env.BROKER_KAFKA],
          },
          consumer: {
            groupId: 'gateway-consumer',
            allowAutoTopicCreation: true,
            retry: {
              retries: 1,
              initialRetryTime: 1000,
              maxRetryTime: 5000,
            },
          },
        },
      },
      {
        name: 'TRAINING_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'gateway',
            brokers: [process.env.BROKER_KAFKA],
          },
          consumer: {
            groupId: 'gateway-consumer',
            allowAutoTopicCreation: true,
            retry: {
              retries: 1,
              initialRetryTime: 1000,
              maxRetryTime: 5000,
            },
          },
        },
      },
    ]),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
