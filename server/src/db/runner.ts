import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool, PoolClient } from 'pg';

const LEDGER = 'schema_migrations';

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    create table if not exists ${LEDGER} (
      name        text primary key,
      applied_at  timestamptz not null default now()
    )
  `);
}

async function appliedSet(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query(`select name from ${LEDGER}`);
  return new Set(rows.map((r: { name: string }) => r.name));
}

function sqlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Applies each pending file in its own transaction and records it, so a file that fails
 * midway rolls back on its own and the ones before it stay applied.
 */
export async function migrate(pool: Pool, dir: string): Promise<string[]> {
  const client = await pool.connect();
  const ran: string[] = [];
  try {
    await ensureLedger(client);
    const done = await appliedSet(client);

    for (const file of sqlFiles(dir)) {
      if (done.has(file)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(`insert into ${LEDGER} (name) values ($1)`, [file]);
        await client.query('commit');
        ran.push(file);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`${file} failed: ${(err as Error).message}`, { cause: err });
      }
    }
  } finally {
    client.release();
  }
  return ran;
}

/**
 * Seeds are re-runnable by construction (every insert ends in ON CONFLICT DO NOTHING),
 * so they are applied in order without a ledger.
 */
export async function seed(pool: Pool, dir: string): Promise<string[]> {
  const ran: string[] = [];
  for (const file of sqlFiles(dir)) {
    await pool.query(readFileSync(join(dir, file), 'utf8'));
    ran.push(file);
  }
  return ran;
}
