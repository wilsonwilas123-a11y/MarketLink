import { Router } from 'express';
import { registry } from '../api/registry.js';
import {
  MarketDetailRef,
  MarketIdParamSchema,
  MarketListQuerySchema,
  MarketListRef,
  NearbyMarketListRef,
  NearbyQuerySchema,
} from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { validate } from '../middleware/validate.js';
import { route } from '../lib/route.js';
import { listMarkets, marketDetail, nearbyMarkets } from '../services/markets.js';
import type { AppDeps } from '../app.js';
import type { MarketListQuery, NearbyQuery } from '../api/schemas.js';

/**
 * Markets are public reads (spec 5.4): the landing page and the discovery screen have to load
 * for someone who has never signed up, so none of these routes take a token.
 *
 * The query and param schemas are mounted as validators and pointed at by the contract from
 * the same constant, which is what keeps `/markets?day=sat` documented as accepting exactly
 * the seven values it actually accepts.
 */
registry.registerPath({
  method: 'get',
  path: '/markets',
  tags: ['Markets'],
  summary: 'List markets, for the discovery screen',
  description:
    'Filters combine: `city` narrows by city, `day` to markets operating that weekday, `q` ' +
    'searches name, address and city, and `open_now` keeps only markets trading at this ' +
    'moment in Lagos. Ordered by name, so paging is stable.',
  request: { query: MarketListQuerySchema },
  responses: {
    200: { description: 'A page of markets.', content: json(MarketListRef) },
    400: error('A day is not one of the seven, or a page number is not positive.'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/markets/nearby',
  tags: ['Markets'],
  summary: 'Markets within a radius of a point, nearest first',
  description:
    'The map and the "nearby" rail. Distances are straight-line kilometres from the point ' +
    'given, not driving times: Lagos traffic is not something this can know, and a number ' +
    'that reads like an ETA invites a user to trust it as one. The query bounds a rectangle ' +
    'and measures inside it, so adding markets does not slow every nearby call down by a ' +
    'full scan.',
  request: { query: NearbyQuerySchema },
  responses: {
    200: {
      description: 'A page of markets, nearest first, each with its distance.',
      content: json(NearbyMarketListRef),
    },
    400: error('`lat` or `lng` is missing or unmap-able, or the radius is not usable.'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/markets/{id}',
  tags: ['Markets'],
  summary: 'One market, its stall roster, and how much is on the tables',
  description:
    'Roster entries carry the stall\'s own pitch reference and the days it attends, which can ' +
    'be narrower than the market\'s own week — a trader who only comes on Saturdays is listed ' +
    'under Saturdays. Pending and suspended stalls are absent rather than marked.',
  request: { params: MarketIdParamSchema },
  responses: {
    200: { description: 'Market detail.', content: json(MarketDetailRef) },
    400: error('`id` is not a uuid.'),
    404: error('No such market, or one the admin has taken off the list.'),
  },
});

export function marketsRouter(deps: AppDeps): Router {
  const r = Router();

  r.get(
    '/markets',
    validate({ query: MarketListQuerySchema }),
    route(async (req, res) => {
      res.json(await listMarkets(deps.pool, req.valid.query as MarketListQuery));
    }),
  );

  // Ahead of `/markets/:id`: `nearby` is not a uuid, so whichever route matched first would
  // answer a perfectly good call with a validation error.
  r.get(
    '/markets/nearby',
    validate({ query: NearbyQuerySchema }),
    route(async (req, res) => {
      res.json(await nearbyMarkets(deps.pool, req.valid.query as NearbyQuery));
    }),
  );

  r.get(
    '/markets/:id',
    validate({ params: MarketIdParamSchema }),
    route(async (req, res) => {
      const { id } = req.valid.params as { id: string };
      res.json(await marketDetail(deps.pool, id));
    }),
  );

  return r;
}
