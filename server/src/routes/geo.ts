import { Router } from 'express';
import { registry } from '../api/registry.js';
import {
  GeoSearchQuerySchema,
  MarketBoxQuerySchema,
  PlaceCandidateListRef,
} from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { route } from '../lib/route.js';
import { parseMarketBox } from '../services/geocode.js';
import type { AppDeps } from '../app.js';
import type { GeoSearchQuery, MarketBoxQuery } from '../api/schemas.js';

/**
 * Turning a typed name into a coordinate.
 *
 * These are the only routes in the API that leave the building, which is why they are the one
 * place the upstream is named in the contract: a caller reading them should know the answer
 * comes from OpenStreetMap and not from MarketLink's own tables, and should expect it to be
 * able to fail for reasons nothing here controls.
 *
 * `/geo/search` sits behind a token even though it reads nothing private. An open endpoint onto
 * a third party's gazetteer is a way for a stranger to spend someone else's goodwill with that
 * gazetteer, and rate limiting on the upstream is not ours to configure. `/places/markets` and its
 * `/box` sibling have to be open — they answer the discovery screen, which works for someone who
 * has never signed up — and each trades that guard for the cache and a bounded question: a
 * three-character minimum and a capped `limit` for the search, a capped corner of the map for the
 * box.
 */
registry.registerPath({
  method: 'get',
  path: '/geo/search',
  tags: ['Places'],
  summary: 'Find a place by name, for dropping a pin on it',
  description:
    'Backed by the OpenStreetMap gazetteer, so it knows places this database has never heard ' +
    'of — which is the point when the row being added is the first of its kind. Results come ' +
    'back in the order the gazetteer ranked them, and are candidates rather than an answer: ' +
    'the caller picks one, and what gets stored is the picker’s choice, not this list. Nothing ' +
    'is written here, and nothing is cached beyond the upstream’s own headers.',
  security: [{ bearerAuth: [] }],
  request: { query: GeoSearchQuerySchema },
  responses: {
    200: { description: 'Candidate pins, best match first.', content: json(PlaceCandidateListRef) },
    400: error('The query is shorter than three characters or longer than eighty.'),
    401: error('No valid token.'),
    429: error('The gazetteer is throttling this server. Retry shortly.'),
    500: error('The gazetteer did not answer, or answered with something unrecognisable.'),
  },
});

/**
 * The same gazetteer, filtered to marketplaces, with no token in front of it.
 *
 * `/markets` is a public read (spec 5.4), and so is the question behind this one — a visitor
 * typing `Ibadan` has to get an answer before they have any reason to have an account. What
 * keeps it off the upstream's bill is the cache rather than a credential: a hundred searches
 * for one city leave this server once per window.
 *
 * The rows are map data, not listings. There is no `id` to open, no trading days, no photo and
 * nothing stocked — only a name, a point and the address around it — which is why they are a
 * different shape in the contract from a `Market` and a different weight on the screen.
 */
registry.registerPath({
  method: 'get',
  path: '/places/markets',
  tags: ['Places'],
  summary: 'Markets the map knows about, listed or not',
  description:
    'Places tagged `amenity=marketplace` in OpenStreetMap. A term that does not already name a ' +
    'market is asked of the gazetteer with the word `market` appended, because a bare town name ' +
    'ranks the town and its streets rather than its gates. These are not MarketLink vendors and ' +
    'have no stall roster behind them; the point is that the continent is bigger than what has ' +
    'been approved here. Attribution is owed to OpenStreetMap contributors wherever these are ' +
    'shown, under ODbL.',
  security: [],
  request: { query: GeoSearchQuerySchema },
  responses: {
    200: {
      description: 'Marketplaces the map knows, best match first. Empty is a real answer.',
      content: json(PlaceCandidateListRef),
    },
    400: error('The query is shorter than three characters or longer than eighty.'),
    429: error('The gazetteer is throttling this server. Retry shortly.'),
    500: error('The gazetteer did not answer, or answered with something unrecognisable.'),
  },
});

/**
 * The same marketplaces, asked by corner of the map instead of by name.
 *
 * This is the door that answers before anyone has typed: the discovery screen opens on a view of
 * Lagos and needs something to show in it. A name cannot do that job: a bare city ranks the city,
 * and the six marketplaces `Lagos` answered with were all nodes literally named "Market".
 *
 * A second upstream answers here, because a gazetteer ranks text and cannot answer "what is in
 * this box"; that service reads the same OpenStreetMap data through a volunteer's mirror. What
 * keeps the request polite is the capped box, the capped `limit` and the cache, and what keeps it
 * honest is that the order carries no ranking — these are simply markets that are there.
 */
registry.registerPath({
  method: 'get',
  path: '/places/markets/box',
  tags: ['Places'],
  summary: 'Markets the map knows about, inside one corner of the map',
  description:
    'Places tagged `amenity=marketplace` in OpenStreetMap within `bbox`, which is at most 0.6° ' +
    'across — roughly the area a visitor can see at one zoom. Nodes the map has not named are ' +
    'left out, since an unlabelled dot is not a choice a visitor can make, and the order carries ' +
    'no ranking. If Overpass mirrors fail, Photon searches the same box for named marketplace ' +
    'nodes so discovery can continue. A relevant, licensed Commons photo is matched to the ' +
    'market name first, with a clearly labeled city or country photo as a fallback. ' +
    'The image fields are null when neither match is available. ' +
    'Not MarketLink vendors: no stall roster, no trading days, no page. Attribution is owed to ' +
    'OpenStreetMap contributors wherever these are shown, under ODbL.',
  security: [],
  request: { query: MarketBoxQuerySchema },
  responses: {
    200: {
      description: 'Named OSM marketplaces in the box, from Overpass or a Photon fallback. May be empty if no named markets are mapped.',
      content: json(PlaceCandidateListRef),
    },
    400: error('The bbox is malformed, inverted, off the planet, or wider than 0.6°.'),
    429: error('The map data service is throttling this server. Retry shortly.'),
    500: error('The map data service did not answer, or answered with something unrecognisable.'),
  },
});

export function geoRouter(deps: AppDeps): Router {
  const r = Router();

  r.get(
    '/geo/search',
    requireAuth(deps.auth, deps.pool),
    validate({ query: GeoSearchQuerySchema }),
    route(async (req, res) => {
      const { q, limit } = req.valid.query as GeoSearchQuery;
      res.json(await deps.geocode.search(q, limit));
    }),
  );

  r.get(
    '/places/markets',
    validate({ query: GeoSearchQuerySchema }),
    route(async (req, res) => {
      const { q, limit } = req.valid.query as GeoSearchQuery;
      res.json(await deps.geocode.markets(q, limit));
    }),
  );

  r.get(
    '/places/markets/box',
    validate({ query: MarketBoxQuerySchema }),
    route(async (req, res) => {
      const { bbox, limit } = req.valid.query as MarketBoxQuery;
      res.json(await deps.geocode.inBox(parseMarketBox(bbox), limit));
    }),
  );

  return r;
}
