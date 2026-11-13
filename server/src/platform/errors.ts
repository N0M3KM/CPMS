import type { ErrorRequestHandler } from 'express';

// Typed, client-safe errors. Messages are fixed text and never echo request input.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static unauthenticated(): AppError {
    return new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  static forbidden(message = 'You do not have access to this action.'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }
  // One error for "not yours" and "does not exist", so the two cases cannot be told apart.
  static notFound(): AppError {
    return new AppError(404, 'NOT_FOUND', 'Not found.');
  }
  static validation(message = 'The request is not valid.'): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message);
  }
  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }
  static unsupportedMediaType(): AppError {
    return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send an application/json request.');
  }
  static payloadTooLarge(): AppError {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request is too large.');
  }
}

function toAppError(err: unknown): AppError | undefined {
  if (err instanceof AppError) return err;
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') return AppError.validation();
  if (type === 'entity.too.large') return AppError.payloadTooLarge();
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') return AppError.unsupportedMediaType();
  // Client errors raised by Express middleware (for example a malformed or NUL-containing URL).
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status ?? (err as { statusCode?: unknown } | null)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (status === 404) return AppError.notFound();
    if (status === 403) return AppError.forbidden();
    return new AppError(status, 'BAD_REQUEST', 'The request could not be processed.');
  }
  return undefined;
}

// Single place that turns errors into the JSON envelope. Unexpected errors are logged on
// the server only and answered with a generic body: no stack, SQL or internals.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const known = toAppError(err);
  if (known) {
    res.status(known.status).json({ error: { code: known.code, message: known.message } });
    return;
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } });
};
