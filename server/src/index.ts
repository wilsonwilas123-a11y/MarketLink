import { Pool } from 'pg';
import { createApp } from './app.js';
import { makeSupabaseAdmin, makeSupabaseAuth } from './lib/auth.js';
import { logger } from './lib/logger.js';
import { loadEnv, loadEnvFile } from './lib/env.js';
import { makeCachedGeocoder, makeNetworkGeocoder } from './services/geocode.js';

// Boot order matters: the file is read first so a validated environment can come from it,
// and a real environment variable still overrides it.
loadEnvFile();
const env = loadEnv();

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });
const supabaseAdmin = makeSupabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
pool.on('error', (err) => {
  // An idle client can die between requests. Logging it here keeps the cause out of the
  // next unrelated 500.
  logger.error('idle database client errored', { message: err.message });
});

const app = createApp(
  {
    pool,
    // The service-role key is read here and nowhere else, which is what makes `grep -rn
    // SERVICE_ROLE server/src` a meaningful audit.
    auth: makeSupabaseAuth(supabaseAdmin),
    productImages: {
      async upload(profileId, fileName, contentType, bytes) {
        const { error } = await supabaseAdmin.storage.from(env.SUPABASE_PRODUCT_BUCKET)
          .upload(`${profileId}/${fileName}`, bytes, { contentType, upsert: false });
        if (error) throw new Error('The product image could not be saved to Supabase Storage.');
        return supabaseAdmin.storage.from(env.SUPABASE_PRODUCT_BUCKET)
          .getPublicUrl(`${profileId}/${fileName}`).data.publicUrl;
      },
    },
    geocode: makeCachedGeocoder(
      makeNetworkGeocoder(env.GEO_USER_AGENT),
      env.GEO_CACHE_MS,
    ),
  },
  { clientOrigin: env.CLIENT_ORIGIN },
);

const server = app.listen(env.PORT, () => {
  logger.info('marketlink api listening', { port: env.PORT, env: env.NODE_ENV });
});

/** Stop taking connections, finish the ones in flight, then let the process exit. */
function shutdown(signal: string): void {
  logger.info('shutting down', { signal });
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal));
}
