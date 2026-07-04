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

    // Body-parser (and other Express/Connect middleware) throw plain errors
    // with a numeric `status`/`statusCode` (e.g. 413 for oversized payloads,
    // 400 for malformed JSON) instead of a Nest HttpException. Honor that
    // status instead of masking it as a 500.
    const rawStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : (exception as { status?: number; statusCode?: number })?.status ??
          (exception as { status?: number; statusCode?: number })?.statusCode;
    const status =
      typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600
        ? rawStatus
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      rawResponse !== null
        ? typeof rawResponse === 'string'
          ? rawResponse
          : ((rawResponse as Record<string, unknown>).message ?? 'Error')
        : status !== HttpStatus.INTERNAL_SERVER_ERROR && exception instanceof Error
          ? exception.message
          : 'Internal server error';

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
