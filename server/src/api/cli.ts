import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from './openapi.js';
// Loading the routers is what registers their paths; the import is the whole point.
import '../routes/index.js';

/**
 * `npm run openapi` — regenerate `openapi.json` at the repository root.
 *
 * The file is committed and a test asserts it matches this output, so the contract in git
 * cannot drift from the code that enforces it: either the test fails or the file is
 * regenerated in the same commit.
 */
const target = resolve(process.cwd(), '..', 'openapi.json');
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`wrote ${target}`);
