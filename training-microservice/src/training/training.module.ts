import { ClientsModule, Transport } from '@nestjs/microservices';

import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AGGREGATION_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'aggregation',
            brokers: [process.env.BROKER_KAFKA],
          },
          consumer: {
            groupId: 'aggregation-consumer',
            allowAutoTopicCreation: true,
            retry: {
              retries: 2, // Define o número máximo de tentativas
              initialRetryTime: 1000, // Tempo inicial de espera entre tentativas (ms)
              multiplier: 2, // Multiplicador exponencial para o tempo de espera
              maxRetryTime: 10000, // Tempo máximo de espera entre tentativas (ms)
            },
          },
        },
      },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
