import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { logger } from '../src/lib/logger.js';
import { fakePool, profileRow, testDeps } from './helpers/app.js';

const auth = { Authorization: 'Bearer a-token' };

describe('request ids', () => {
  it('mints one for every response, including a 404', async () => {
    const res = await request(createApp(testDeps())).get('/api/nothing');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a caller-supplied id so both sides of a trace line up', async () => {
    const res = await request(createApp(testDeps()))
      .get('/api/healthz')
      .set('x-request-id', 'trace-42');
    expect(res.headers['x-request-id']).toBe('trace-42');
  });

  it('discards an id that could forge a header or a log line', async () => {
    const res = await request(createApp(testDeps()))
      .get('/api/healthz')
      .set('x-request-id', '../../etc/passwd');
    expect(res.headers['x-request-id']).not.toBe('../../etc/passwd');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('unknown routes', () => {
  it('answers with the error envelope, not an HTML page', async () => {
    const res = await request(createApp(testDeps())).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'not_found', message: 'No route matches GET /api/nothing.' },
    });
  });
});

describe('unparsable bodies', () => {
  it('are a 400 with a readable message', async () => {
    const res = await request(createApp(testDeps()))
      .patch('/api/me')
      .set(auth)
      .set('Content-Type', 'application/json')
      .send('{"phone": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});

describe('unexpected failures', () => {
  it('answer with a fixed message and log the real cause', async () => {
    const down = fakePool([profileRow]);
    down.query = (async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:55432 marketlink_test');
    }) as unknown as typeof down.query;

    const spy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const res = await request(createApp(testDeps({ pool: down }))).get('/api/me').set(auth);

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({
      code: 'internal',
      message: 'Something went wrong on our side.',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|marketlink_test|55432/);

    const logged = spy.mock.calls.find(([message]) => message === 'request failed');
    expect(logged?.[1]).toMatchObject({ path: '/api/me' });
    expect(String(logged?.[1]?.message)).toContain('ECONNREFUSED');
    spy.mockRestore();
  });
});

describe('security headers', () => {
  it('does not advertise the framework', async () => {
    const res = await request(createApp(testDeps())).get('/api/healthz');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
