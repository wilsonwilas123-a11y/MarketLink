import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

/**
 * One registry for the whole API. Routes and schemas register themselves into it as they
 * are defined, which is what keeps `openapi.json` from drifting: there is no second
 * place where the contract is written down that could disagree with the validator.
 */
export const registry = new OpenAPIRegistry();

export { registry as default };

/**
 * Bearer auth, defined here because the generator's document config omits `components`.
 *
 * Worth stating in the contract: the server verifies the token with Supabase and then
 * reads the role from `profiles`, so deactivating an account or suspending a stall takes
 * effect on the next request rather than when the token happens to expire.
 */
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'A Supabase access token, sent as `Authorization: Bearer <jwt>`.',
});

/** Opt schemas into carrying OpenAPI metadata, then re-export the enriched `z`. */
extendZodWithOpenApi(z);
export { z };
