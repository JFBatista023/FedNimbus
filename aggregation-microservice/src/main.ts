import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AggregationModule } from './aggregation/aggregation.module';
import { NestFactory } from '@nestjs/core';
import { configDotenv } from 'dotenv';

configDotenv();

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AggregationModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: [process.env.BROKER_KAFKA],
          clientId: 'aggregation',
        },
        consumer: {
          groupId: 'aggregation-consumer',
          retry: {
            retries: 1, // Define o número máximo de tentativas
            initialRetryTime: 1000, // Tempo inicial de espera entre tentativas (ms)
            multiplier: 2, // Multiplicador exponencial para o tempo de espera
            maxRetryTime: 10000, // Tempo máximo de espera entre tentativas (ms)
          },
        },
      },
    },
  );
  await app.listen();
}
bootstrap();
