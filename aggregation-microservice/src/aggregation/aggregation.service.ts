import { Injectable, Logger } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import { addDoc, collection } from 'firebase/firestore';
import { firestore } from 'src/infra/firebase/firebase.config';

@Injectable()
export class AggregationService {
  private readonly aggCollection = collection(firestore, 'aggregated-weights');
  private readonly logger = new Logger(AggregationService.name);
  private weightBuffer: number[][] = [];
  private readonly BUFFER_SIZE = 2;

  async processWeights(weights: number[]) {
    try {
      if (!weights || weights.length === 0) {
        this.logger.warn('Received empty or invalid weights.');
        return;
      }

      this.weightBuffer.push(weights);
      this.logger.debug(
        `Buffer size: ${this.weightBuffer.length}/${this.BUFFER_SIZE}`,
      );

      if (this.weightBuffer.length >= this.BUFFER_SIZE) {
        await this.performAggregation();
      }
    } catch (error) {
      this.logger.error(`Error processing weights: ${error.message}`);
    }
  }

  private async performAggregation() {
    try {
      const aggregatedWeights = this.calculateFedAvg();
      this.weightBuffer = []; // Esvazia o buffer antes de salvar

      await addDoc(this.aggCollection, {
        weights: aggregatedWeights,
        createdAt: new Date(),
        modelCount: this.BUFFER_SIZE,
      });

      this.logger.log(`Aggregation completed for ${this.BUFFER_SIZE} models`);
    } catch (error) {
      this.logger.error(`Aggregation failed: ${error.message}`);
      throw error;
    }
  }

  private calculateFedAvg(): number[] {
    if (this.weightBuffer.length === 0) return [];

    // Valida consistência dos pesos
    const expectedLength = this.weightBuffer[0].length;
    if (!this.weightBuffer.every(w => w.length === expectedLength)) {
      throw new Error('Inconsistent weight dimensions across models');
    }

    // Calcula média federada
    return tf.tidy(() => {
      const tensors = this.weightBuffer.map(w => tf.tensor1d(w));
      const stacked = tf.stack(tensors);
      const meanTensor = stacked.mean(0);
      const result = Array.from(meanTensor.dataSync()); // Salva resultado antes de sair do tf.tidy()
      tensors.forEach(t => t.dispose()); // Libera tensores individuais
      stacked.dispose();
      meanTensor.dispose();
      return result;
    });
  }
}
