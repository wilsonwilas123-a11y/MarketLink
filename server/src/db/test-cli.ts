import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to server/.env first.');
  process.exit(1);
}

const dir = join(resolve(process.cwd(), '..'), 'db', 'tests');

/**
 * pgTAP assertions come back as one text column reading `ok N - title` or
 * `not ok N - title`, so a plain multi-statement query gives us everything we need
 * without depending on pg_prove being installed. Each file wraps itself in
 * BEGIN/ROLLBACK, so nothing it writes survives.
 */
function parseResults(chunks: unknown[][]): { passed: number; failed: string[]; planned: number | null } {
  let passed = 0;
  let planned: number | null = null;
  const failed: string[] = [];
  for (const rows of chunks) {
    for (const row of rows) {
      const line = Object.values(row as object)[0];
      if (typeof line !== 'string') continue;
      const plan = /^1\.\.(\d+)$/.exec(line);
      if (plan) planned = Number(plan[1]);
      else if (line.startsWith('not ok')) failed.push(line);
      else if (line.startsWith('ok ')) passed += 1;
    }
  }
  return { passed, failed, planned };
}

const pool = new Pool({ connectionString: url, max: 1 });
let totalFailed: string[] = [];
let totalPassed = 0;

try {
  try {
    await pool.query('create extension if not exists pgtap');
  } catch {
    console.error(
      'pgtap extension unavailable. On Supabase, enable it under Database > Extensions.\n' +
        'On plain Postgres it must be built and installed into the server.',
    );
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(join(dir, file), 'utf8');
      const results = await pool.query(sql);
      const { passed, failed, planned } = parseResults(
        (Array.isArray(results) ? results : [results]).map((r) => r.rows ?? []),
      );
      const problems = [...failed.map((f) => `${file}: ${f}`)];
      if (planned !== null && passed + failed.length !== planned) {
        problems.push(
          `${file}: planned ${planned} assertions but ran ${passed + failed.length}`,
        );
      }
      totalPassed += passed;
      totalFailed = totalFailed.concat(problems);
      console.log(`${file}: ${passed} passed${problems.length ? `, ${problems.length} FAILED` : ''}`);
    }
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

if (totalFailed.length) {
  console.error(`\n${totalFailed.length} failing:`);
  for (const f of totalFailed) console.error(`  ${f}`);
  process.exitCode = 1;
} else if (process.exitCode !== 1) {
  console.log(`\n${totalPassed} database checks passed`);
}
