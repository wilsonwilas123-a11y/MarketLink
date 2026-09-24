import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not await a handler, so a rejected async handler becomes an unhandled
 * rejection and the request hangs until the client gives up. Routing the rejection to
 * `next` is what lets the error handler turn it into a section 9.1 envelope.
 *
 * Handlers return `void` or a promise depending on how boring they are; both are accepted
 * so a route never has to be `async` just to satisfy this signature.
 */
export function route(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    try {
      void Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
