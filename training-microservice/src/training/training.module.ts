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
          },
        },
      },
    ]),
  ],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
