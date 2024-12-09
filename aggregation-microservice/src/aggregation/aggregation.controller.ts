import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AggregationService } from './aggregation.service';

@Controller()
export class AggregationController {
  constructor(private readonly aggregationService: AggregationService) {}

  @EventPattern('model-weights')
  async handleModelWeights(@Payload() message: any) {
    const { userId, weights } = message;
    await this.aggregationService.processWeights(userId, weights);
  }
}
