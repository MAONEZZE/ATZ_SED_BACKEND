import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      rawResponse === null
        ? 'Internal server error'
        : typeof rawResponse === 'string'
          ? rawResponse
          : (rawResponse as Record<string, unknown>).message ?? 'Error';

    if (status >= 500) {
      this.logger.error({ err: exception, path: req.url }, 'Unhandled error');
    }

    res.status(status).json({
      statusCode: status,
      message,
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString(),
    });
  }
}
