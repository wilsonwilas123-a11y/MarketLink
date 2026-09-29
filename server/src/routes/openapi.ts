import { Router } from 'express';
import { buildOpenApiDocument } from '../api/openapi.js';
import { route } from '../lib/route.js';


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
