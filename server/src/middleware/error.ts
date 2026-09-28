import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError, isApiError } from '../errors.js';
import { logger } from '../lib/logger.js';

/** Anything that fell through the router. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError('not_found', `No route matches ${req.method} ${req.path}.`));
};

function statusFor(err: unknown): number {
  if (isApiError(err)) return err.status;
  // body-parser tags malformed JSON this way; it is the client's mistake, not ours.
  if (err instanceof SyntaxError && 'body' in err) return 400;
  return 500;
}

/**
 * The single place an exception becomes a response.
 *
 * Unexpected failures are logged in full and answered with a fixed message: a database
 * error string can carry a query, a table name or a connection detail, and none of those
 * belong in a public response body.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = statusFor(err);

  if (status >= 500) {
    logger.error('request failed', {
      reqId: req.requestId,
      method: req.method,
      path: req.path,
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });
    res.status(status).json(new ApiError('internal', 'Something went wrong on our side.', {
      request_id: req.requestId,
      ...(process.env.NODE_ENV === 'development' ? { diagnostic: (err as Error)?.message } : {}),
    }).toJSON());
    return;
  }

  const body = isApiError(err)
    ? err
    : new ApiError('validation_failed', 'The request could not be read as JSON.');

  logger.warn('request rejected', {
    reqId: req.requestId,
    method: req.method,
    path: req.path,
    code: body.code,
  });

  res.status(status).json(body.toJSON());
};
