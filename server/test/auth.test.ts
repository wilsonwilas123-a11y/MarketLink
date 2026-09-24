import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { NextFunction, Request, Response } from 'express';
import { createApp } from '../src/app.js';
import { requireRole } from '../src/middleware/auth.js';
import { demoSubject, fakeAuth, fakePool, profileRow, testDeps } from './helpers/app.js';

const bearer = (token = 'a-token') => ({ Authorization: `Bearer ${token}` });

/** The exit test for phase 3, phrased as the spec phrases it. */
describe('GET /api/me unauthenticated', () => {
  it('returns 401 with the unauthenticated code', async () => {
    const res = await request(createApp(testDeps())).get('/api/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'unauthenticated', message: 'A bearer token is required.' },
    });
  });

  it('is 401 for a token Supabase does not recognise, not 403', async () => {
    const res = await request(createApp(testDeps({ auth: fakeAuth(null) })))
      .get('/api/me')
      .set(bearer());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('accepts only the bearer scheme', async () => {
    const res = await request(createApp(testDeps()))
      .get('/api/me')
      .set({ Authorization: `Token ${'a'.repeat(40)}` });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('A bearer token is required.');
  });
});

describe('requireAuth profile lookup', () => {
  it('points a token with no profile row at bootstrap', async () => {
    // First canned result is the profile lookup: nothing found.
    const res = await request(createApp(testDeps({ pool: fakePool([null]) }))
    )
      .get('/api/me')
      .set(bearer());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('profile_missing');
    expect(res.body.error.message).toContain('POST /api/auth/bootstrap');
  });

  it('refuses a deactivated profile with its own code', async () => {
    const res = await request(
      createApp(testDeps({ pool: fakePool([{ ...profileRow, is_active: false }]) })),
    )
      .get('/api/me')
      .set(bearer());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_disabled');
  });

  it('reads the role from the database rather than from the token', async () => {
    const pool = fakePool([profileRow]);
    await request(createApp(testDeps({ pool }))).get('/api/me').set(bearer());

    expect(pool.calls[0]?.text).toContain('from profiles');
    expect(pool.calls[0]?.values).toEqual([demoSubject.id]);
  });
});

describe('requireRole', () => {
  const run = (role: string | undefined, allowed: Parameters<typeof requireRole>) =>
    new Promise<{ passed: boolean; code?: string }>((resolve) => {
      const req = {
        ...(role ? { user: { id: demoSubject.id, role, isActive: true } } : {}),
      } as unknown as Request;

      const next: NextFunction = (err?: unknown) => {
        const code = (err as (Error & { code?: string }) | undefined)?.code;
        resolve(err ? { passed: false, code } : { passed: true });
      };

      requireRole(...allowed)(req, {} as Response, next);
    });

  it('passes a permitted role through', async () => {
    expect(await run('farmer', ['farmer', 'admin'])).toEqual({ passed: true });
  });

  it('rejects a role outside the gate with forbidden', async () => {
    expect(await run('customer', ['farmer'])).toEqual({ passed: false, code: 'forbidden' });
  });

  it('rejects a missing user as unauthenticated, so the gate leaks nothing', async () => {
    expect(await run(undefined, ['admin'])).toEqual({ passed: false, code: 'unauthenticated' });
  });
});
