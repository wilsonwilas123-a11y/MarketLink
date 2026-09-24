import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

/**
 * The document's identity, and the reason `openapi.json` is safe to generate rather than
 * maintain: routes and schemas register themselves next to their validators and handlers,
 * so there is no second copy of the contract that could disagree with the first.
 *
 * 3.0.3 rather than 3.1 because the validators and importers this is fed — swagger-parser
 * here, an API-readiness scan in phase 20 — are firmest on 3.0.
 */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'MarketLink API',
      version: '0.1.0',
      description:
        'The contract behind the MarketLink farmers-market app. Every route sits under `/api` and ' +
        'every failure carries the same envelope: `{ error: { code, message, details? } }`. Clients ' +
        'branch on `code`, never on `message`. Money is integer kobo end to end and formatted to ' +
        '₦ only at the edge. There is no payment endpoint — orders settle in person at pickup.',
    },
    servers: [
      { url: '/api', description: 'Same origin as the app' },
      { url: 'http://localhost:4000/api', description: 'Local development' },
    ],
    tags: [
      { name: 'Health', description: 'Liveness and the API contract itself.' },
      { name: 'Auth', description: 'Turning a Supabase account into a MarketLink profile.' },
      { name: 'Profile', description: "The caller's own record." },
    ],
  });
}
