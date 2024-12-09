import * as tf from '@tensorflow/tfjs-node';

import { addDoc, collection } from 'firebase/firestore';

import { Injectable } from '@nestjs/common';
import { firestore } from 'src/infra/firebase/firebase.config';

@Injectable()
export class AggregationService {
  private readonly aggCollection = collection(firestore, 'aggregated-weights');
  private weightBuffer: Map<string, any[]> = new Map();
  private readonly BUFFER_SIZE = 1;

  async processWeights(userId: string, weights: number[][]) {
    if (!this.weightBuffer.has(userId)) {
      this.weightBuffer.set(userId, []);
    }

    const buffer = this.weightBuffer.get(userId);
    buffer.push(weights);

    if (buffer.length >= this.BUFFER_SIZE) {
      await this.performAggregation(userId);
    }
  }

  private async performAggregation(userId: string) {
    const weights = this.weightBuffer.get(userId);

    const aggregatedWeights = weights[0].map((_, layerIndex) => {
      const layerWeights = weights.map(model => model[layerIndex]);
      return tf.tensor(layerWeights).mean().arraySync();
    });

    await addDoc(this.aggCollection, {
      userId,
      weights: aggregatedWeights,
      timestamp: new Date(),
      numberOfModels: weights.length,
    });

    this.weightBuffer.set(userId, []);
  }
}
