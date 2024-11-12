import { Controller } from '@nestjs/common';
import { TrainingService } from './training.service';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @EventPattern('training_requests')
  async handleTrainingRequest(@Payload() payload: any) {
    const { idFromToken } = payload;
    await this.trainingService.processTrainingRequest(idFromToken);
  }
}
