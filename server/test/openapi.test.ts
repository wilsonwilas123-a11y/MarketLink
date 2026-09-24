import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPIV3 } from 'openapi-types';
import { buildOpenApiDocument } from '../src/api/openapi.js';
import '../src/routes/index.js';

const document = buildOpenApiDocument() as unknown as OpenAPIV3.Document;
const committed = JSON.parse(
  readFileSync(new URL('../../openapi.json', import.meta.url), 'utf8'),
) as OpenAPIV3.Document;

describe('openapi.json', () => {
  it('passes the OpenAPI 3.0 validator', async () => {
    // A dangling $ref or a malformed parameter fails here rather than in a client import.
    await expect(SwaggerParser.validate(structuredClone(document))).resolves.toBeTruthy();
  });

  it('is the contract for the routes that exist, under /api', async () => {
    await expect(SwaggerParser.validate(structuredClone(committed))).resolves.toBeTruthy();
    // Order follows `routes/index.ts`, which is the order the routers register their paths
    // as they are imported — not the order `createApp` mounts them.
    expect(Object.keys(committed.paths ?? {})).toEqual([
      '/auth/bootstrap',
      '/me',
      '/farmers',
      '/farmers/{id}',
      '/farmers/me',
      '/farmers/me/geo',
      '/farmers/me/markets',
      '/healthz',
      '/markets',
      '/markets/nearby',
      '/markets/{id}',
    ]);
    expect(Object.keys(committed.paths?.['/me'] ?? {})).toEqual(['get', 'patch']);
  });

  it('says which routes need a token', () => {
    expect(committed.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    expect(committed.paths?.['/healthz']?.get?.security).toEqual([]);
    expect(committed.paths?.['/me']?.get?.security).toEqual([{ bearerAuth: [] }]);
  });

  it('documents every failure as the same envelope', () => {
    const response = committed.paths?.['/auth/bootstrap']?.post?.responses?.['400'];
    const schema = (response as OpenAPIV3.ResponseObject).content?.['application/json']?.schema;
    expect(schema).toEqual({ $ref: '#/components/schemas/Error' });
    expect(committed.components?.schemas?.Error).toBeDefined();
  });

  it('matches the code, so a schema change without a regeneration fails here', () => {
    expect(committed).toEqual(document);
  });
});
