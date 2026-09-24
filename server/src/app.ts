import express, { type Express } from 'express';
import type { Pool } from 'pg';
import cors from 'cors';
import { healthRouter } from './routes/health.js';

export type Role = 'customer' | 'farmer' | 'admin';

export interface AuthUser {
  id: string;
  role: Role;
  isActive: boolean;
}

export interface AppDeps {
  pool: Pool;
  verifyToken: (token: string) => Promise<AuthUser | null>;
}

export function createApp(deps: AppDeps, clientOrigin = process.env.CLIENT_ORIGIN): Express {
  const app = express();
  app.set('deps', deps);
  app.use(cors({ origin: clientOrigin ?? true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', healthRouter(deps.pool));
  return app;
}
