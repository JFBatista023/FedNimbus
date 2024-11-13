export class TrainingParams {
  id?: string;
  userId: string;

  // Parâmetros de treinamento
  learningRate: number;
  epochs: number;
  batchSize: number;

  // Status e tempo
  hasConverged: boolean;
  createdAt: Date;

  // Métricas do último epoch
  metrics: {
    finalLoss: number;
    finalMse: number;
    finalMae?: number; // Mean Absolute Error
    finalRmse?: number; // Root Mean Square Error
  };

  // Histórico de métricas
  trainingHistory: {
    epochNumber: number;
    loss: number;
    mse: number;
    mae?: number;
    validationLoss?: number;
    validationMse?: number;
    learningRate?: number;
  }[];

  // Informações adicionais
  modelInfo: {
    trainingDuration: number; // em millisegundos
    totalParameters?: number; // número total de parâmetros do modelo
    convergenceEpoch?: number; // epoch onde ocorreu a convergência
    earlyStoppedAt?: number; // epoch onde ocorreu early stopping, se aplicável
  };

  constructor(data: Partial<TrainingParams>) {
    this.userId = data.userId;
    this.learningRate = data.learningRate || 0.01;
    this.epochs = data.epochs || 10;
    this.batchSize = data.batchSize || 32;
    this.hasConverged = data.hasConverged || false;
    this.createdAt = data.createdAt || new Date();
    this.metrics = data.metrics || {
      finalLoss: 0,
      finalMse: 0,
    };
    this.trainingHistory = data.trainingHistory || [];
    this.modelInfo = data.modelInfo || {
      trainingDuration: 0,
    };
  }
}
