import express, { type Express } from 'express';
import type { Pool } from 'pg';
import cors from 'cors';
import helmet from 'helmet';
import type { AuthVerifier } from './lib/auth.js';
import { requestId } from './middleware/request-id.js';
import { errorHandler, notFound } from './middleware/error.js';
import {
  authRouter,
  farmersRouter,
  healthRouter,
  marketsRouter,
  openApiRouter,
} from './routes/index.js';

export interface AppDeps {
  pool: Pool;
  auth: AuthVerifier;
}

export interface AppOptions {
  /** The browser origin allowed to call this API with credentials. */
  clientOrigin?: string;
}

/**
 * The whole server as a function of its dependencies.
 *
 * Every external touchpoint — database, identity provider — arrives here, which is what
 * lets a test mount a route against a stubbed verifier and a query-recording pool without
 * a Postgres, a Supabase project, or a network. `index.ts` is the only file that supplies
 * the real ones.
 */
export function createApp(deps: AppDeps, options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  // First, so every response — including the 404 and 500 bodies — carries the id it was logged under.
  app.use(requestId);
  // Nothing here serves HTML, so a CSP would only be a list of headers to debug.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: options.clientOrigin ?? true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter(deps.pool));
  app.use('/api', authRouter(deps));
  app.use('/api', marketsRouter(deps));
  app.use('/api', farmersRouter(deps));
  app.use('/api', openApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
