import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';


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
      { name: 'Markets', description: 'Public market discovery, including the distance query.' },
      { name: 'Farmers', description: "Public stall profiles, and the owner's own view." },
      { name: 'Places', description: 'Place lookup against OpenStreetMap, for pinning something new.' },
    ],
  });
}
