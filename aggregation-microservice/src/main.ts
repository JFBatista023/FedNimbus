import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { NestFactory } from '@nestjs/core';
import { configDotenv } from 'dotenv';
import { AggregationModule } from './aggregation/aggregation.module';

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
        },
      },
    },
  );
  await app.listen();
}
bootstrap();
