import { AggregationController } from './aggregation.controller';
import { AggregationService } from './aggregation.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [AggregationController],
  providers: [AggregationService],
})
export class AggregationModule {}
