import { Router } from 'express';
import { buildOpenApiDocument } from '../api/openapi.js';
import { route } from '../lib/route.js';

/**
 * The contract, served by the API that implements it.
 *
 * `openapi.json` on disk is the reviewable artifact; this is the same document at request
 * time, so a tool pointed at a running server (an API client, a Postman import) reads the
 * truth rather than a copy that a redeploy left behind.
 */
export function openApiRouter(): Router {
  const r = Router();
  const doc = JSON.stringify(buildOpenApiDocument());

  r.get(
    '/openapi.json',
    route((_req, res) => {
      res.type('application/json').send(doc);
    }),
  );

  return r;
}
