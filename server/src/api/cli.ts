import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from './openapi.js';
// Loading the routers is what registers their paths; the import is the whole point.
import '../routes/index.js';


const target = resolve(process.cwd(), '..', 'openapi.json');
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`wrote ${target}`);
