import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { migrate, seed } from './runner.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to server/.env first.');
  process.exit(1);
}

const command = process.argv[2];
if (command !== 'migrate' && command !== 'seed') {
  console.error(`Unknown command "${command ?? ''}". Use: migrate | seed`);
  process.exit(1);
}

// The CLI runs from server/, and db/ sits at the repository root beside the workspaces.
const repoRoot = resolve(process.cwd(), '..');
const pool = new Pool({ connectionString: url, max: 1 });

try {
  if (command === 'migrate') {
    const ran = await migrate(pool, join(repoRoot, 'db', 'migrations'));
    console.log(ran.length ? `applied:\n  ${ran.join('\n  ')}` : 'already up to date');
  } else {
    const ran = await seed(pool, join(repoRoot, 'db', 'seed'));
    console.log(`seeded:\n  ${ran.join('\n  ')}`);
  }
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
