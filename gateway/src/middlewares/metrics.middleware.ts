import { Injectable, NestMiddleware } from '@nestjs/common';
import { Histogram } from 'prom-client';

const httpRequestDurationMicroseconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP no API Gateway',
  labelNames: ['method', 'route', 'status_code'],
});

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      httpRequestDurationMicroseconds
        .labels(req.method, req.originalUrl, res.statusCode.toString())
        .observe(duration);
    });
    next();
  }
}
