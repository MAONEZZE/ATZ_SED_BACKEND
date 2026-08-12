import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    const logLine = () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.logger.log({
        timestamp: new Date().toISOString(),
        method: req.method,
        endpoint: req.originalUrl ?? req.url,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
        requestId: req.headers['x-request-id'],
      });
    };

    return next.handle().pipe(tap({ next: logLine, error: logLine }));
  }
}
