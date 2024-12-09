import { PartialType } from '@nestjs/mapped-types';
import { CreateAggregationDto } from './create-aggregation.dto';

export class UpdateAggregationDto extends PartialType(CreateAggregationDto) {
  id: number;
}
