import type { NextFunction, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import type { AuthSubject, AuthVerifier } from '../lib/auth.js';
import type { Role } from '../api/schemas.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      subject?: AuthSubject;
      user?: AuthUser;
    }
  }
}

/** Who is calling, as resolved from the database rather than from a token claim. */
export interface AuthUser {
  id: string;
  role: Role;
  isActive: boolean;
}

function bearer(req: { header(name: string): string | undefined }): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Verifies the access token and nothing more.
 *
 * `POST /auth/bootstrap` uses this rather than `requireAuth`, because bootstrap is the
 * call that creates the profile row `requireAuth` insists on. Requiring a profile in
 * order to create a profile is the deadlock this exists to avoid.
 */
export function requireSubject(verify: AuthVerifier): RequestHandler {
  return async (req, _res, next) => {
    const token = bearer(req);
    if (!token) {
      next(new ApiError('unauthenticated', 'A bearer token is required.'));
      return;
    }
    try {
      const subject = await verify.getUser(token);
      if (!subject) {
        next(new ApiError('unauthenticated', 'The token is missing, expired or invalid.'));
        return;
      }
      req.subject = subject;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Resolves a verified caller to an active profile.
 *
 * Chains `requireSubject` rather than assuming it ran first: a route that mounted only
 * this gate would otherwise refuse everyone with "A bearer token is required" while
 * holding a perfectly good token, which reads like a client bug and is a wiring one.
 *
 * The role is read from `profiles`, not from a JWT claim, so revoking a farmer or
 * suspending an account takes effect on the next request rather than whenever the token
 * happens to be refreshed.
 */
export function requireAuth(verify: AuthVerifier, pool: Pool): RequestHandler {
  const subjectGate = requireSubject(verify);

  return (req, res, next) => {
    subjectGate(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      void loadProfile(req, pool, next);
    });
  };
}

async function loadProfile(req: Request, pool: Pool, next: NextFunction): Promise<void> {
  try {
    const { rows } = await pool.query(
      'select id, role, is_active from profiles where id = $1',
      [currentSubject(req).id],
    );
    const row = rows[0];
    if (!row) {
      next(
        new ApiError(
          'unauthenticated',
          'This account has no profile yet. Call POST /api/auth/bootstrap first.',
        ),
      );
      return;
    }
    if (row.is_active !== true) {
      next(new ApiError('account_disabled', 'This account has been deactivated.'));
      return;
    }
    req.user = { id: String(row.id), role: row.role as Role, isActive: true };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role gate, applied after `requireAuth`. Checked separately rather than folded into it
 * so an unauthenticated request is answered with 401, not 403 — a 403 here would tell a
 * caller the route exists and that their credentials merely lack a role.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new ApiError('unauthenticated', 'A bearer token is required.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ApiError('forbidden', 'This account is not permitted to do that.'));
      return;
    }
    next();
  };
}

/**
 * Readers for what the middleware above already guaranteed. A handler that reaches these
 * without the matching middleware has a routing bug, so the message names the middleware
 * rather than describing a state a client could cause.
 */
export function currentSubject(req: Request): AuthSubject {
  if (!req.subject) throw new Error('handler used without requireSubject');
  return req.subject;
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('handler used without requireAuth');
  return req.user;
}
