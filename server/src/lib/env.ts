import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * `z.string().url()` accepts http(s) only, and three of these values are not: a
 * `postgres://` connection string, and an origin a deployer may run on any scheme. This
 * accepts anything the WHATWG URL parser understands and nothing else.
 */
function url(field: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: `${field} must be a valid URL.` },
    );
}

/**
 * Environment, validated at boot.
 *
 * The server refuses to start on a missing or malformed value rather than failing on the
 * first request that happened to need it, and it needs `SUPABASE_SERVICE_ROLE_KEY` because
 * that is the only key allowed to read past row level security. `SUPABASE_ANON_KEY` is
 * deliberately absent: it belongs to the browser bundle, and a server that never needed it
 * is one that cannot accidentally log it.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
  DATABASE_URL: url('DATABASE_URL'),
  SUPABASE_URL: url('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(40),
  CLIENT_ORIGIN: url('CLIENT_ORIGIN'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Read `server/.env` so `npm run dev` needs no shell setup.
 *
 * Values already present in the real environment win, which is what lets CI or a deployer
 * override the file without deleting it.
 */
export function loadEnvFile(dir: string = process.cwd()): void {
  const file = resolve(dir, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(
      `Refusing to start with an invalid environment:\n${lines.join('\n')}\n\n` +
        'Copy .env.example to server/.env and fill in the values.',
    );
  }
  return parsed.data;
}
