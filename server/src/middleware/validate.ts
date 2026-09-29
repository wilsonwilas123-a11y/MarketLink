import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '../errors.js';

declare global {
  namespace Express {
    interface Request {
      /** Parsed input. Deliberately not written back onto `req.body`/`req.query`. */
      valid: Record<string, unknown>;
    }
  }
}


export function validate(parts: {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}): RequestHandler {
  return (req, _res, next) => {
    req.valid ??= {};
    try {
      if (parts.body) req.valid.body = parts.body.parse(req.body);
      if (parts.query) req.valid.query = parts.query.parse(req.query);
      if (parts.params) req.valid.params = parts.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new ApiError(
            'validation_failed',
            'The request was not valid.',
            // Field-oriented rather than a dump, so a form can highlight the right input.
            // A strict-mode rejection names every extra key in one issue at the object root;
            // split so each offending field gets its own line.
            err.issues.flatMap((i) =>
              i.code === 'unrecognized_keys'
                ? i.keys.map((key) => ({ field: key, message: `Unknown field "${key}".` }))
                : [{ field: i.path.join('.') || '(root)', message: i.message }],
            ),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
