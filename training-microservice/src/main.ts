import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { NestFactory } from '@nestjs/core';
import { configDotenv } from 'dotenv';
import { TrainingModule } from './training/training.module';

configDotenv();

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    TrainingModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'training',
          brokers: [process.env.BROKER_KAFKA],
        },
        consumer: {
          groupId: 'training-consumer',
        },
      },
    },
  );
  await app.listen();
}
bootstrap();
