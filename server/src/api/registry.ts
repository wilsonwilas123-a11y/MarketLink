import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';


export const registry = new OpenAPIRegistry();

export { registry as default };


registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'A Supabase access token, sent as `Authorization: Bearer <jwt>`.',
});

/** Opt schemas into carrying OpenAPI metadata, then re-export the enriched `z`. */
extendZodWithOpenApi(z);
export { z };
