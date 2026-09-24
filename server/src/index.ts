import { Pool } from 'pg';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Copy .env.example to server/.env and fill it in.');
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 10 });

const app = createApp({
  pool,
  // JWT verification is built in phase 3. Until then every authenticated route is
  // refused rather than silently trusted.
  verifyToken: async () => {
    throw new Error('auth is not implemented yet (phase 3)');
  },
});

app.listen(port, () => {
  console.log(`marketlink api listening on :${port}`);
});
