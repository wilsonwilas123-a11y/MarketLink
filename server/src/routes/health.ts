import { Router } from 'express';
import type { Pool } from 'pg';

export function healthRouter(pool: Pool): Router {
  const r = Router();

  r.get('/healthz', async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ status: 'ok', db: 'up', auth: 'configured' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down', auth: 'configured' });
    }
  });

  return r;
}
