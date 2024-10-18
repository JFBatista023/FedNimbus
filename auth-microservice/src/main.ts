import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { UsersModule } from './users/users.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    UsersModule,
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: 'auth',
          brokers: ['kafka:9092'],
        },
        consumer: {
          groupId: 'auth-consumer',
        },
      },
    },
  );
  await app.listen();
}
bootstrap();
