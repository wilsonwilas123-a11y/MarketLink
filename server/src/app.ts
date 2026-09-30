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
  geoRouter,
  healthRouter,
  marketsRouter,
  openApiRouter,
  ordersRouter,
  adminRouter,
  favoritesRouter,
  uploadsRouter,
  notificationsRouter,
  productsRouter,
  chatbotRouter,
} from './routes/index.js';
import type { Geocoder } from './services/geocode.js';

export interface AppDeps {
  pool: Pool;
  auth: AuthVerifier;
  /** OpenStreetMap place lookup. The only outbound call this API makes. */
  geocode: Geocoder;
  /** Uploads an authenticated farmer's product photo and returns its public URL. */
  productImages?: { upload(profileId: string, fileName: string, contentType: string, bytes: Buffer): Promise<string> };
  /** Optional server-only Gemini configuration for the public MarketLink help assistant. */
  gemini?: { apiKey: string; model: string };
}

export interface AppOptions {
  /** The browser origin allowed to call this API with credentials. */
  clientOrigin?: string;
}


export function createApp(deps: AppDeps, options: AppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');
  // First, so every response — including the 404 and 500 bodies — carries the id it was logged under.
  app.use(requestId);
  // Nothing here serves HTML, so a CSP would only be a list of headers to debug.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: options.clientOrigin ?? true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Lightweight uptime check: no database, no auth. Point the monitor here.
  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api', healthRouter(deps.pool));
  app.use('/api', authRouter(deps));
  app.use('/api', marketsRouter(deps));
  app.use('/api', farmersRouter(deps));
  app.use('/api', productsRouter(deps));
  app.use('/api', ordersRouter(deps));
  app.use('/api', adminRouter(deps));
  app.use('/api', favoritesRouter(deps));
  app.use('/api', uploadsRouter(deps));
  app.use('/api', notificationsRouter(deps));
  app.use('/api', chatbotRouter(deps));
  app.use('/api', geoRouter(deps));
  app.use('/api', openApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}