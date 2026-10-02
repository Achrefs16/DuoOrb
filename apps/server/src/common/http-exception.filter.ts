import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/**
 * Every error body the API ever sends, in one contract shape the mobile
 * taxonomy (network/errors.ts) parses:
 *
 *   { statusCode, message, code, retryable, retryAfterMs? }
 *
 * `message` is always a single human string (Nest validation errors arrive as
 * an array — the first element wins). `code` is machine-readable:
 * AUTH / VALIDATION / CONFLICT / RATE_LIMIT / SERVER. `retryable` tells the
 * client whether a retry button makes sense; rate limits add `retryAfterMs`
 * so the client can print "wait Xs".
 *
 * Non-HTTP throws (bugs) become a 500 SERVER with no internals leaked.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const req = ctx.getRequest<{ method: string; url: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something broke on our side.';
    let code: string | undefined;
    let retryable = false;
    let retryAfterMs: number | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const raw = body.message;
        message = Array.isArray(raw) ? String(raw[0]) : String(raw || message);
        if (typeof body.code === 'string') code = body.code;
        if (typeof body.retryable === 'boolean') retryable = body.retryable;
        if (typeof body.retryAfterMs === 'number') retryAfterMs = body.retryAfterMs;
      }
    } else {
      this.logger.error(
        `Unhandled ${req.method} ${req.url}: ${(exception as Error)?.message}`
      );
    }

    // Defaults when the throw site did not stamp the contract fields.
    if (!code) {
      if (status === 401 || status === 403) code = 'AUTH';
      else if (status === 400) code = 'VALIDATION';
      else if (status === 409) code = 'CONFLICT';
      else if (status === 429) code = 'RATE_LIMIT';
      else if (status >= 500) code = 'SERVER';
    }
    if (status >= 500) retryable = true;
    // A 429 is always safe to retry after a beat, whatever the throw site said.
    if (status === 429) retryable = true;

    if (status === 401 || status === 403 || status >= 500) {
      this.logger.warn(`${req.method} ${req.url} -> ${status} (${code})`);
    }

    res.status(status).json({
      statusCode: status,
      message,
      code,
      retryable,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    });
  }
}
