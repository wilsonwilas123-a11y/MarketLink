import { Router } from 'express';
import type { Pool } from 'pg';
import { registry } from '../api/registry.js';
import { HealthRef, type Health } from '../api/schemas.js';
import { json } from '../api/responses.js';
import { route } from '../lib/route.js';

registry.registerPath({
  method: 'get',
  path: '/healthz',
  tags: ['Health'],
  summary: 'Liveness and database reachability',
  description:
    'Answers 200 only when `select 1` succeeds. Both statuses carry the same body, because a probe is read as a document rather than handled as an error.',
  security: [],
  responses: {
    200: { description: 'The API and its database are both answering.', content: json(HealthRef) },
    503: { description: 'The API is up but cannot reach the database.', content: json(HealthRef) },
  },
});

export function healthRouter(pool: Pool): Router {
  const r = Router();

  r.get(
    '/healthz',
    route(async (_req, res) => {
      let body: Health = { status: 'ok', db: 'up' };
      try {
        await pool.query('select 1');
      } catch {
        body = { status: 'degraded', db: 'down' };
      }
      res.status(body.db === 'up' ? 200 : 503).json(body);
    }),
  );

  return r;
}
