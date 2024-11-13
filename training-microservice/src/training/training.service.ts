import { Injectable } from '@nestjs/common';
import * as tf from '@tensorflow/tfjs-node';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import * as fs from 'fs';
import { firestore, storage } from 'src/infra/firebase/firebase.config';
import { TrainingParams } from './entities/training.entity';

@Injectable()
export class TrainingService {
  private readonly paramsCollection = collection(firestore, 'params-info');
  private readonly CONVERGENCE_THRESHOLD = {
    loss: 0.05,
    mse: 0.1,
  };

  async processTrainingRequest(idFromToken: string) {
    console.log(`Iniciando treinamento para o usuário com ID: ${idFromToken}`);

    // Passo 1: Verifica se existem parâmetros de treinamento existentes
    const recentParams = await this.getRecentParams(idFromToken);

    if (recentParams?.hasConverged) {
      // Alterar
      return {
        status: 'already_converged',
        message: 'Modelo já convergiu anteriormente para este usuário',
        lastTrainingParams: recentParams,
      };
    }

    const initialParams = recentParams || this.getInitialParams(idFromToken);
    const trainingStartTime = new Date().getTime();
    const trainingHistory = [];

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
    const history = await model.fit(dataset.xs, dataset.ys, {
      epochs: initialParams.epochs,
      batchSize: initialParams.batchSize,
      validationSplit: 0.2, // Adiciona validação split
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          // Coleta métricas a cada epoch
          const epochMetrics = {
            epochNumber: epoch,
            loss: Number(logs.loss),
            mse: Number(logs.mse),
            validationLoss: logs.val_loss ? Number(logs.val_loss) : undefined,
            validationMse: logs.val_mse ? Number(logs.val_mse) : undefined,
            learningRate: initialParams.learningRate,
          };
          trainingHistory.push(epochMetrics);
        },
      },
    });

    // Passo 6: Verifica a convergência e salva os parâmetros
    const converged = this.checkConvergence(model);

    const trainingEndTime = new Date().getTime();
    const trainingDuration = trainingEndTime - trainingStartTime;

    const finalMse = Number(history.history['mse'].slice(-1)[0]);
    const finalRmse = Math.sqrt(finalMse);

    const newTrainingParams = new TrainingParams({
      userId: idFromToken,
      learningRate: initialParams.learningRate,
      epochs: initialParams.epochs,
      batchSize: initialParams.batchSize,
      hasConverged: converged,
      createdAt: new Date(),
      metrics: {
        finalLoss: Number(history.history['loss'].slice(-1)[0]),
        finalMse: finalMse,
        finalRmse: finalRmse,
        finalMae: history.history['mae']
          ? Number(history.history['mae'].slice(-1)[0])
          : undefined,
      },
      trainingHistory: trainingHistory,
      modelInfo: {
        trainingDuration: trainingDuration,
        totalParameters: model.countParams(),
        convergenceEpoch: converged ? trainingHistory.length : undefined,
        earlyStoppedAt:
          history.epoch.length < initialParams.epochs
            ? history.epoch.length
            : undefined,
      },
    });

    await addDoc(this.paramsCollection, { ...newTrainingParams });

    // Alterar
    return { status: 'completed', converged };
  }

  private getInitialParams(userId: string): TrainingParams {
    return new TrainingParams({
      userId,
      learningRate: 0.01,
      epochs: 10,
      batchSize: 32,
      hasConverged: false,
      createdAt: new Date(),
    });
  }

  private async getRecentParams(
    userId: string,
  ): Promise<TrainingParams | null> {
    const q = query(
      this.paramsCollection,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1),
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    return new TrainingParams({
      id: snapshot.docs[0].id,
      ...data,
      createdAt: data.createdAt.toDate(),
    });
  }

  private async downloadDataset(path: string): Promise<string> {
    const destFilename = '/tmp/wine-quality.csv';

    if (fs.existsSync(destFilename)) {
      console.log('Dataset já existe localmente. Pulando o download.');
      return destFilename;
    }

    // Caso o arquivo não exista, realiza o download
    const bucket = storage.bucket(process.env.STORAGE_BUCKET);
    const file = bucket.file(path);
    await file.download({ destination: destFilename });
    console.log('Download do dataset concluído.');

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

  private buildModel(): tf.LayersModel {
    const model = tf.sequential();
    model.add(
      tf.layers.dense({ units: 64, inputShape: [11], activation: 'relu' }),
    );
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 })); // Saída para regressão
    return model;
  }

  private checkConvergence(model: tf.LayersModel): boolean {
    const lastLoss = Number(model.history.history['loss'].slice(-1)[0]);
    const lastMse = Number(model.history.history['mse'].slice(-1)[0]);

    return (
      lastLoss < this.CONVERGENCE_THRESHOLD.loss &&
      lastMse < this.CONVERGENCE_THRESHOLD.mse
    );
  }
}
