import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fakePool, testDeps } from './helpers/app.js';

describe('GET /api/healthz', () => {
  it('reports ok when the database answers', async () => {
    const app = createApp(testDeps({ pool: fakePool([{ one: 1 }]) }));
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('reports degraded with a 503 when the database is unreachable', async () => {
    const broken = fakePool();
    broken.query = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof broken.query;

    const res = await request(createApp(testDeps({ pool: broken }))).get('/api/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', db: 'down' });
  });

  it('answers every failure with the request id it was logged under', async () => {
    const res = await request(createApp(testDeps({ pool: fakePool() }))).get('/api/nope');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
