import { ClientsModule, Transport } from '@nestjs/microservices';

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
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
            clientId: 'auth',
            brokers: [process.env.BROKER_KAFKA],
          },
          consumer: {
            groupId: 'auth-consumer',
            allowAutoTopicCreation: true,
            retry: {
              retries: 1, // Define o número máximo de tentativas
              initialRetryTime: 1000, // Tempo inicial de espera entre tentativas (ms)
              multiplier: 2, // Multiplicador exponencial para o tempo de espera
              maxRetryTime: 10000, // Tempo máximo de espera entre tentativas (ms)
            },
          },
        },
      },
      {
        name: 'TRAINING_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'training',
            brokers: [process.env.BROKER_KAFKA],
          },
          consumer: {
            groupId: 'training-consumer',
            allowAutoTopicCreation: true,
            retry: {
              retries: 1, // Define o número máximo de tentativas
              initialRetryTime: 1000, // Tempo inicial de espera entre tentativas (ms)
              multiplier: 2, // Multiplicador exponencial para o tempo de espera
              maxRetryTime: 10000, // Tempo máximo de espera entre tentativas (ms)
            },
          },
        },
      },
    ]),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '1h' },
    }),
    PrometheusModule.register(),
  ],
  controllers: [GatewayController],
  providers: [GatewayService],
})
export class GatewayModule {}
