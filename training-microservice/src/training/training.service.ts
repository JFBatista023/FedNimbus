import * as fs from 'fs';
import * as path from 'path';
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
import { firestore, storage } from 'src/infra/firebase/firebase.config';
import { getDownloadURL, ref } from 'firebase/storage';

import { Injectable } from '@nestjs/common';
import { TrainingParams } from './entities/training.entity';

@Injectable()
export class TrainingService {
  private readonly paramsCollection = collection(firestore, 'params-info');
  private readonly aggCollection = collection(firestore, 'aggregated-weights');
  private readonly CONVERGENCE_THRESHOLD = {
    loss: 0.05,
    mse: 0.1,
  };

  async processTrainingRequest(idFromToken: string) {
    console.log(`Iniciando treinamento para o usuário com ID: ${idFromToken}`);

    // Passo 1: Verifica se existem parâmetros de treinamento existentes
    const userLastTraining = await this.getUserLastTrainingInfos(idFromToken);

    if (userLastTraining?.hasConverged) {
      return {
        status: 'already_converged',
        message: 'Modelo já convergiu anteriormente para este usuário',
        lastTrainingParams: userLastTraining,
      };
    }

    const recentParams = await this.getAggregateWeights();
    const initialParams = recentParams || this.getInitialParams();
    const trainingStartTime = new Date().getTime();
    const trainingHistory = [];

    // Passo 2: Baixar o dataset
    const datasetPath = await this.downloadDataset();
    const dataset = this.loadDatasetFromCSV(datasetPath);

    // Passo 3: Configura o modelo e inicializa com os pesos apropriados
    const model = this.buildModel();

    // Converte os pesos salvos para tensores
    const weightTensors = initialParams.aggregatedWeights.map(w =>
      tf.tensor(w, undefined, 'float32'),
    );

    // Atribui os pesos ao modelo usando setWeights
    model.setWeights(weightTensors);

    // Passo 4: Compila o modelo
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
            validationLoss: logs.val_loss ? Number(logs.val_loss) : null,
            validationMse: logs.val_mse ? Number(logs.val_mse) : null,
            learningRate: initialParams.learningRate,
          };
          trainingHistory.push(epochMetrics);
        },
      },
    });

    // Passo 6: Verifica a convergência e salva os parâmetros
    const converged = this.checkConvergence(history);

    const trainingEndTime = new Date().getTime();
    const trainingDuration = trainingEndTime - trainingStartTime;

    const finalMse = Number(history.history['mse'].slice(-1)[0]);
    const finalRmse = Math.sqrt(finalMse);

    const weights = model.trainableWeights;
    const serializedWeights = weights.map(w => Array.from(w.read().dataSync()));

    const trainingHistoryMapped = trainingHistory.map(epoch => ({
      epochNumber: epoch.epochNumber,
      loss: epoch.loss,
      mse: epoch.mse,
      validationLoss: epoch.validationLoss ?? null,
      validationMse: epoch.validationMse ?? null,
      learningRate: epoch.learningRate,
    }));

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
        validationLoss: history.history['val_loss']
          ? Number(
              this.getValueFromTensorOrNumber(
                history.history['val_loss'].slice(-1)[0],
              ),
            )
          : null,
        validationMse: history.history['val_mse']
          ? Number(
              this.getValueFromTensorOrNumber(
                history.history['val_mse'].slice(-1)[0],
              ),
            )
          : null,
      },
      trainingHistory: trainingHistoryMapped,
      modelInfo: {
        trainingDuration: trainingDuration,
        totalParameters: model.countParams(),
        convergenceEpoch: converged ? trainingHistory.length : null,
        earlyStoppedAt:
          history.epoch.length < initialParams.epochs
            ? history.epoch.length
            : null,
      },
    });

    // Remove o id antes de salvar
    const { id, ...trainingParamsWithoutId } = newTrainingParams;
    await addDoc(this.paramsCollection, trainingParamsWithoutId);

    // Alterar
    return { status: 'completed', converged };
  }

  private getInitialParams(): TrainingParams {
    const model = this.buildModel();
    const initialWeights = model.trainableWeights.map(w => {
      const heInitializer = tf.initializers.heNormal({ seed: 42 });
      const tensor = heInitializer.apply(w.read().shape);
      return tensor.arraySync();
    });

    return new TrainingParams({
      learningRate: 0.01,
      epochs: 10,
      batchSize: 32,
      hasConverged: false,
      createdAt: new Date(),
      aggregatedWeights: initialWeights,
    });
  }

  private async getAggregateWeights(): Promise<TrainingParams | null> {
    const q = query(this.aggCollection, orderBy('createdAt', 'desc'), limit(1));

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const data = snapshot.docs[0].data();
    return new TrainingParams({
      id: snapshot.docs[0].id,
      ...data,
      createdAt: data.createdAt.toDate(),
    });
  }

  private async getUserLastTrainingInfos(
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

  private async downloadDataset(): Promise<string> {
    // Obtém o diretório atual do arquivo (onde o código está sendo executado)
    const currentDir = __dirname;

    // Sobe dois níveis e cria o caminho para a pasta 'dataset'
    const datasetDir = path.join(currentDir, '../../dataset');

    // Verifica se a pasta 'dataset' existe, caso contrário, cria
    if (!fs.existsSync(datasetDir)) {
      fs.mkdirSync(datasetDir, { recursive: true });
    }

    // Define o nome do arquivo dentro da pasta 'dataset'
    const destFilename = path.join(datasetDir, 'winequality-white.csv');

    // Verifica se o dataset já existe localmente
    if (fs.existsSync(destFilename)) {
      console.log('Dataset já existe localmente. Pulando o download.');
      return destFilename;
    }

    try {
      // Cria uma referência ao arquivo
      const datasetRef = ref(storage, 'winequality-white.csv');

      // Obtém a URL de download do arquivo
      const url = await getDownloadURL(datasetRef);

      // Realiza o download do arquivo usando fetch
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao baixar o dataset: ${response.statusText}`);
      }

      // Converte o conteúdo para um buffer e grava o arquivo localmente
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(destFilename, buffer);
      console.log('Download do dataset concluído.');

      return destFilename;
    } catch (error: any) {
      switch (error.code) {
        case 'storage/object-not-found':
          console.error('Arquivo não encontrado no Firebase Storage.');
          break;
        case 'storage/unauthorized':
          console.error('Acesso não autorizado ao Firebase Storage.');
          break;
        case 'storage/canceled':
          console.error('Download cancelado.');
          break;
        case 'storage/unknown':
        default:
          console.error('Erro desconhecido:', error.message);
      }
      throw error;
    }
  }

  private loadDatasetFromCSV(filePath: string) {
    const data = fs.readFileSync(filePath, 'utf8');
    const rows = data.split('\n').slice(1); // Remove o cabeçalho
    const xs = [];
    const ys = [];
    const expectedColumns = 11; // Número de colunas de entrada

    rows.forEach(row => {
      const values = row.split(';').map(value => parseFloat(value.trim())); // Usa ponto e vírgula como delimitador
      if (values.length === expectedColumns + 1) {
        // Certifica-se que todas as colunas estão presentes
        xs.push(values.slice(0, -1)); // Entrada: todas as colunas exceto 'quality'
        ys.push(values[values.length - 1]); // Saída: coluna 'quality'
      }
    });

    if (xs.length === 0 || ys.length === 0) {
      throw new Error(
        'O dataset está vazio ou mal formatado. Verifique o arquivo de entrada.',
      );
    }

    return {
      xs: tf.tensor2d(xs, [xs.length, expectedColumns]), // Define a forma explicitamente
      ys: tf.tensor1d(ys), // Saída: array unidimensional
    };
  }

  // Função auxiliar para extrair o valor de um tensor ou número
  private getValueFromTensorOrNumber(value: number | tf.Tensor): number {
    return value instanceof tf.Tensor ? value.dataSync()[0] : value;
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

  private checkConvergence(history: tf.History): boolean {
    const lastLoss = Number(history.history['loss'].slice(-1)[0]);
    const lastMse = Number(history.history['mse'].slice(-1)[0]);

    return (
      lastLoss < this.CONVERGENCE_THRESHOLD.loss &&
      lastMse < this.CONVERGENCE_THRESHOLD.mse
    );
  }
}
