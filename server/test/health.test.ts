import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { fakePool, testDeps } from './helpers/app.js';

describe('GET /api/healthz', () => {
  it('reports ok when the database answers', async () => {
    const app = createApp(testDeps({ pool: fakePool([{ ok: 1 }]) }));
    const res = await request(app).get('/api/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up', auth: 'configured' });
  });

  it('reports degraded with a 503 when the database is unreachable', async () => {
    const broken = fakePool();
    (broken.query as unknown) = async () => {
      throw new Error('connection refused');
    };
    const res = await request(createApp(testDeps({ pool: broken }))).get('/api/healthz');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
