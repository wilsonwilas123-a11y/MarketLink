import type { NextFunction, Request, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import type { AuthSubject, AuthVerifier } from '../lib/auth.js';
import { isDesignatedAdmin } from '../lib/adminAccess.js';
import { verifyAdminSession } from '../lib/adminSession.js';
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
  email: string | null;
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

/** Dedicated server-password admin sessions are accepted only by admin routes. */
export function requireAdminSession(): RequestHandler {
  return (req, _res, next) => {
    const token = bearer(req);
    const session = token ? verifyAdminSession(token) : null;
    if (!session) {
      next(new ApiError('unauthenticated', 'A valid admin session is required.'));
      return;
    }
    req.user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: session.email,
      role: 'admin',
      isActive: true,
    };
    next();
  };
}


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
          'profile_missing',
          'This account has no profile yet. Call POST /api/auth/bootstrap first.',
        ),
      );
      return;
    }
    if (row.is_active !== true) {
      next(new ApiError('account_disabled', 'This account has been deactivated.'));
      return;
    }
    const role = row.role as Role;
    req.user = { id: String(row.id), email: currentSubject(req).email, role, isActive: true };
    next();
  } catch (err) {
    next(err);
  }
}


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
    if (roles.includes('admin') && !isDesignatedAdmin(req.user.email)) {
      next(new ApiError('forbidden', 'This account is not the designated admin email.'));
      return;
    }
    next();
  };
}


export function currentSubject(req: Request): AuthSubject {
  if (!req.subject) throw new Error('handler used without requireSubject');
  return req.subject;
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('handler used without requireAuth');
  return req.user;
}
