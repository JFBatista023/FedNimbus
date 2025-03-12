import * as tf from '@tensorflow/tfjs-node';
import * as fs from 'fs';
import * as path from 'path';

import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { firestore, storage } from 'src/infra/firebase/firebase.config';

import { Inject, Injectable } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { TrainingParams } from './entities/training.entity';

@Injectable()
export class TrainingService {
  constructor(
    @Inject('AGGREGATION_SERVICE') private aggregation_client: ClientKafka,
  ) {}

  private readonly paramsCollection = collection(firestore, 'params-info');
  private readonly aggCollection = collection(firestore, 'aggregated-weights');
  private readonly CONVERGENCE_THRESHOLD = {
    loss: 0.05,
    mse: 0.1,
  };
  private readonly layerShapes = [
    [11, 64], // Primeira camada
    [64], // Bias da primeira camada
    [64, 32], // Segunda camada
    [32], // Bias da segunda camada
    [32, 1], // Camada de saída
    [1], // Bias da camada de saída
  ];
  // Calcula o total de pesos esperado baseado na arquitetura
  private readonly expectedTotalWeights = this.layerShapes.reduce(
    (total, shape) => total + shape.reduce((a, b) => a * b, 1),
    0,
  );

  async processTrainingRequest(idFromToken: string) {
    console.log(`Iniciando treinamento para o usuário com ID: ${idFromToken}`);

    try {
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

      if (
        !initialParams.aggregatedWeights ||
        initialParams.aggregatedWeights.length === 0
      ) {
        throw new Error('Pesos iniciais inválidos');
      }

      console.log('Parâmetros iniciais:', {
        weightsLength: initialParams.aggregatedWeights.length,
        layerSizes: initialParams.aggregatedWeights.map(w => w.length),
      });

      const trainingStartTime = new Date().getTime();
      const trainingHistory = [];

      // Passo 2: Baixar o dataset
      const datasetPath = await this.downloadDataset();
      const dataset = this.loadDatasetFromCSV(datasetPath);

      // Converter o array unidimensional em tensores usando os shapes corretos
      let currentIndex = 0;
      const weightTensors = this.layerShapes.map(shape => {
        const size = shape.reduce((a, b) => a * b, 1);
        const layerWeights = initialParams.aggregatedWeights.slice(
          currentIndex,
          currentIndex + size,
        );
        currentIndex += size;

        console.log('Criando tensor:', {
          shape,
          size,
          weightsLength: layerWeights.length,
          sampleWeights: layerWeights.slice(0, 5),
        });

        return tf.tensor(layerWeights, shape);
      });

      // Passo 3: Configura o modelo e inicializa com os pesos apropriados
      const model = this.buildModel();

      if (weightTensors.length !== model.getWeights().length) {
        throw new Error(
          `Número incorreto de pesos: esperado ${model.getWeights().length}, recebido ${weightTensors.length}`,
        );
      }

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
        validationSplit: 0.3, // Adiciona validação split
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
      const serializedWeights = weights.map(w =>
        Array.from(w.read().dataSync()),
      );

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
            ? Number(history.history['val_loss'].slice(-1)[0])
            : null,
          validationMse: history.history['val_mse']
            ? Number(history.history['val_mse'].slice(-1)[0])
            : null,
        },
        trainingHistory: trainingHistory,
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

      // Enviar pesos para o microserviço de agregação
      return this.aggregation_client.emit('model-weights', {
        userId: idFromToken,
        weights: serializedWeights.flat(), // Garantir que os pesos estejam achatados
      });
    } catch (error) {
      console.error('Erro no processamento do treinamento:', error);
      throw error;
    }
  }

  private getInitialParams(): TrainingParams {
    try {
      const model = this.buildModel();
      let currentIndex = 0;
      const initialWeights = [];

      // Gera pesos para cada camada mantendo a estrutura
      for (const shape of this.layerShapes) {
        const size = shape.reduce((a, b) => a * b, 1);
        const heInitializer = tf.initializers.heNormal({ seed: 42 });
        const tensor = heInitializer.apply(shape);
        const weights = Array.from(tensor.dataSync());

        if (weights.length !== size) {
          throw new Error(
            `Inconsistência na inicialização: esperado ${size} pesos, gerado ${weights.length}`,
          );
        }

        initialWeights.push(...weights);
        currentIndex += size;
      }

      // Validação final dos pesos iniciais
      if (initialWeights.length !== this.expectedTotalWeights) {
        throw new Error(
          `Número incorreto de pesos iniciais: esperado ${this.expectedTotalWeights}, gerado ${initialWeights.length}`,
        );
      }

      console.log('Pesos iniciais gerados:', {
        totalWeights: initialWeights.length,
        expectedWeights: this.expectedTotalWeights,
        layerShapes: this.layerShapes,
      });

      return new TrainingParams({
        learningRate: 0.01,
        epochs: 10,
        batchSize: 32,
        hasConverged: false,
        createdAt: new Date(),
        aggregatedWeights: initialWeights,
      });
    } catch (error) {
      console.error('Erro ao gerar pesos iniciais:', error);
      throw error;
    }
  }

  private async getAggregateWeights(): Promise<TrainingParams | null> {
    try {
      const q = query(
        this.aggCollection,
        orderBy('createdAt', 'desc'),
        limit(1),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log('Nenhum peso agregado encontrado, usando pesos iniciais');
        return null;
      }

      const data = snapshot.docs[0].data();

      // Validação dos pesos agregados
      if (!this.validateWeights(data.weights)) {
        console.log('Pesos agregados inválidos, usando pesos iniciais');
        return null;
      }

      console.log('Pesos agregados validados:', {
        id: snapshot.docs[0].id,
        totalWeights: data.weights.length,
        expectedWeights: this.expectedTotalWeights,
      });

      return new TrainingParams({
        id: snapshot.docs[0].id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        aggregatedWeights: data.weights,
      });
    } catch (error) {
      console.error('Erro ao buscar pesos agregados:', error);
      return null;
    }
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

  private buildModel(): tf.LayersModel {
    const model = tf.sequential();

    // Primeira camada densa: entrada 11, saída 64
    model.add(
      tf.layers.dense({
        units: 64,
        inputShape: [11],
        activation: 'relu',
      }),
    );

    // Segunda camada densa: 64 -> 32
    model.add(
      tf.layers.dense({
        units: 32,
        activation: 'relu',
      }),
    );

    // Camada de saída: 32 -> 1
    model.add(
      tf.layers.dense({
        units: 1,
      }),
    );

    return model;
  }

  private validateWeights(weights: number[]): boolean {
    if (!weights || !Array.isArray(weights)) return false;
    if (weights.length !== this.expectedTotalWeights) return false;
    if (weights.some(w => typeof w !== 'number' || isNaN(w))) return false;
    return true;
  }

  private checkConvergence(history: tf.History): boolean {
    const lastLoss = Number(history.history['loss'].slice(-1)[0]);
    const lastMse = Number(history.history['mse'].slice(-1)[0]);
    console.log(lastLoss, lastMse);

    return (
      lastLoss < this.CONVERGENCE_THRESHOLD.loss &&
      lastMse < this.CONVERGENCE_THRESHOLD.mse
    );
  }
}
