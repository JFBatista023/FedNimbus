export class TrainingParams {
  id?: string;
  userId: string;

  // Hiperparâmetros do treinamento
  learningRate: number;
  epochs: number;
  batchSize: number;

  // Status do treinamento
  hasConverged: boolean;
  createdAt: Date;

  // Métricas finais do treinamento
  metrics: {
    finalLoss: number;
    finalMse: number;
    finalRmse: number;
    validationLoss?: number;
    validationMse?: number;
  };

  // Histórico de métricas por epoch
  trainingHistory: Array<{
    epochNumber: number;
    loss: number;
    mse: number;
    validationLoss?: number;
    validationMse?: number;
    learningRate: number;
  }>;

  // Informações sobre o treinamento
  modelInfo: {
    trainingDuration: number; // Duração em millisegundos
    totalParameters: number; // Número total de parâmetros treináveis
    convergenceEpoch: number | null; // Em qual epoch convergiu (null se não convergiu)
    earlyStoppedAt: number | null; // Em qual epoch parou (null se completou todas as epochs)
  };

  // Pesos do modelo após treinamento (apenas treináveis)
  aggregatedWeights: any[];

  constructor(data: Partial<TrainingParams>) {
    this.id = data.id;
    this.userId = data.userId;
    this.learningRate = data.learningRate || 0.01;
    this.epochs = data.epochs || 20;
    this.batchSize = data.batchSize || 32;
    this.hasConverged = data.hasConverged || false;
    this.createdAt = data.createdAt || new Date();

    this.metrics = {
      finalLoss: data.metrics?.finalLoss || 0,
      finalMse: data.metrics?.finalMse || 0,
      finalRmse: data.metrics?.finalRmse || 0,
      validationLoss: data.metrics?.validationLoss,
      validationMse: data.metrics?.validationMse,
    };

    this.trainingHistory = data.trainingHistory || [];

    this.modelInfo = {
      trainingDuration: data.modelInfo?.trainingDuration || 0,
      totalParameters: data.modelInfo?.totalParameters || 0,
      convergenceEpoch: data.modelInfo?.convergenceEpoch || null,
      earlyStoppedAt: data.modelInfo?.earlyStoppedAt || null,
    };

    this.aggregatedWeights = data.aggregatedWeights || [];
  }
}
