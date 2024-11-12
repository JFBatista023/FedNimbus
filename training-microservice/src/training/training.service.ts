import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import * as fs from 'fs';
import { firestore, storage } from 'src/infra/firebase/firebase.config';

@Injectable()
export class TrainingService {
  private paramsCollection = collection(firestore, 'params-info');

  async processTrainingRequest(idFromToken: string) {
    console.log(`Iniciando treinamento para o usuário com ID: ${idFromToken}`);

    // Passo 1: Verifica se existem parâmetros de treinamento existentes
    const recentParams = await this.getRecentParams(idFromToken);
    const initialParams = recentParams || this.getInitialParams();

    // Passo 2: Baixar o dataset do Storage emulador
    const datasetPath = await this.downloadDataset('path/to/wine-quality.csv');
    const dataset = this.loadDatasetFromCSV(datasetPath);

    // Passo 3: Configura o modelo
    const model = this.buildModel();

    // Passo 4: Compila o modelo com os parâmetros mais recentes
    model.compile({
      optimizer: tf.train.adam(initialParams.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mse'],
    });

    // Passo 5: Treinamento
    await model.fit(dataset.xs, dataset.ys, {
      epochs: initialParams.epochs,
      batchSize: initialParams.batchSize,
    });

    // Condição de Convergência
    const converged = this.checkConvergence(model);
    if (converged) {
      console.log('Modelo convergiu com sucesso!');
      // Aqui você pode salvar o modelo ou notificar a convergência.
    }

    return { status: 'completed', converged };
  }

  private async getRecentParams(userId: string) {
    const q = query(
      this.paramsCollection,
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(1),
    );
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : snapshot.docs[0].data();
  }

  private getInitialParams() {
    return {
      learningRate: 0.01,
      epochs: 10,
      batchSize: 32,
    };
  }

  private async downloadDataset(path: string): Promise<string> {
    const bucket = storage.bucket(process.env.STORAGE_BUCKET);
    const file = bucket.file(path);
    const destFilename = '/tmp/wine-quality.csv';
    await file.download({ destination: destFilename });
    return destFilename;
  }

  private loadDatasetFromCSV(filePath: string) {
    const data = fs.readFileSync(filePath, 'utf8');
    const rows = data.split('\n').slice(1); // Remove header
    const xs = [];
    const ys = [];

    rows.forEach(row => {
      const values = row.split(';').map(parseFloat);
      xs.push(values.slice(0, -1)); // Atributos
      ys.push(values[values.length - 1]); // Qualidade (label)
    });

    return {
      xs: tf.tensor2d(xs),
      ys: tf.tensor1d(ys),
    };
  }

  private buildModel() {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ units: 64, inputShape: [11], activation: 'relu' }),
    );
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 })); // Saída para regressão
    return model;
  }

  private checkConvergence(model: tf.LayersModel): boolean {
    // Checa se a perda é suficientemente baixa para considerar o modelo convergido
    const lastLoss = model.history.history['loss'].slice(-1)[0];
    return lastLoss < 0.05; // Critério de convergência arbitrário
  }
}
