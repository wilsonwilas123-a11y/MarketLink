import { Router } from 'express';
import { ApiError } from '../errors.js';
import { registry } from '../api/registry.js';
import {
  FarmerDetailRef,
  FarmerIdParamSchema,
  FarmerListQuerySchema,
  FarmerListRef,
  FarmerMarketListRef,
  FarmerMarketAssignmentsRef,
  FarmerMarketAssignmentsSchema,
  GeoPinRef,
  GeoPinSchema,
  MyStallRef,
  UpdateStallRef,
  UpdateStallSchema,
} from '../api/schemas.js';
import type {
  FarmerListQuery,
  GeoPin,
  UpdateStallInput,
} from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { route } from '../lib/route.js';
import {
  farmerDetail,
  listFarmers,
  myStall,
  myStallMarkets,
  saveMyStallMarkets,
  pinStall,
  updateStall,
} from '../services/farmers.js';
import type { AppDeps } from '../app.js';
import { FarmerReplySchema } from '../api/schemas.js';
import { listFarmerReviews, replyToReview } from '../services/reviews.js';
import { z } from 'zod';


registry.registerPath({
  method: 'get',
  path: '/farmers',
  tags: ['Farmers'],
  summary: 'List approved stalls',
  description:
    'Approved stalls only. `market_id` and `category` are "sells there / sells in" rather than ' +
    'joins, so a stall at four markets appears once. Ordered by rating, which is the only ' +
    'signal a shopper who has never seen the stall has.',
  request: { query: FarmerListQuerySchema },
  responses: {
    200: { description: 'A page of stalls.', content: json(FarmerListRef) },
    400: error('`market_id` is not a uuid, or a page number is not positive.'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/farmers/me/markets',
  tags: ['Farmers'],
  summary: 'Set the markets where the caller trades',
  description: 'The stall owner can choose active markets in the same currency and only days both the stall and market operate.',
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: { 'application/json': { schema: FarmerMarketAssignmentsRef } } } },
  responses: { 200: { description: 'Updated stall markets.', content: json(FarmerMarketListRef) }, 400: error('Market assignments or trading days are invalid.'), 403: error('Farmer accounts only.') },
});

registry.registerPath({
  method: 'get', path: '/farmers/me/insights', tags: ['Farmers'], summary: 'Read sales and weekly stock insights',
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'All-time order totals, completed pickup value and best sellers.' }, 401: error('No valid token.'), 403: error('The account is not a farmer.'), 404: error('The farmer stall does not exist.') },
});

registry.registerPath({
  method: 'get',
  path: '/farmers/{id}',
  tags: ['Farmers'],
  summary: 'A stall profile: markets, this week, and recent reviews',
  description:
    'Products carry this ISO week\'s quantity, and a listing with no stock row for the current ' +
    'week reads sold out rather than unlimited — a quantity nobody checked is not one you can ' +
    'order. Reviews are the ten most recent visible ones; the full history is not this ' +
    'screen\'s job.',
  request: { params: FarmerIdParamSchema },
  responses: {
    200: { description: 'Stall profile.', content: json(FarmerDetailRef) },
    400: error('`id` is not a uuid.'),
    404: error('No such stall, or one that is not approved — which is answered the same way.'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/farmers/me',
  tags: ['Farmers'],
  summary: "The caller's own stall, including its approval status",
  description:
    'The awaiting-approval screen and the stock editor are the same payload read two ways: ' +
    '`status` here decides which one opens. Unlike the public profile, this shows a stall in ' +
    'any state, because it belongs to the person standing behind it.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'The caller\'s stall.', content: json(MyStallRef) },
    401: error('No valid token.'),
    403: error('The account is active but is not a farmer.'),
    404: error('The account is a farmer but has no stall row.'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/farmers/me',
  tags: ['Farmers'],
  summary: 'Edit the stall: name, story, days, pickup window, cutoff',
  description:
    'Partial — an absent field is left alone and an explicit `null` clears it. `status` is not ' +
    'an editable field: approval is the admin queue\'s decision, and a farmer who could patch ' +
    'it would walk their own stall onto the public catalogue.',
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(UpdateStallRef) } },
  responses: {
    200: { description: 'The stall as now stored.', content: json(MyStallRef) },
    400: error('No field was supplied, a day name is not one of the seven, or the pickup ' +
      'window closes before it opens.'),
    401: error('No valid token.'),
    403: error('The account is not a farmer.'),
    404: error('The account is a farmer but has no stall row.'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/farmers/me/geo',
  tags: ['Farmers'],
  summary: 'Move the stall pin from the map picker',
  description:
    'Its own route rather than a field on the stall patch because it is a different gesture: a ' +
    'drag on a map, not a form submit. It should not have to resend a description the farmer ' +
    'never touched in order to shift a marker a hundred metres.',
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(GeoPinRef) } },
  responses: {
    200: { description: 'The stall, pinned.', content: json(MyStallRef) },
    400: error('A coordinate is missing or off the map.'),
    401: error('No valid token.'),
    403: error('The account is not a farmer.'),
    404: error('The account is a farmer but has no stall row.'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/farmers/me/markets',
  tags: ['Farmers'],
  summary: 'Which markets the caller’s stall attends',
  description:
    'Each entry carries the pitch reference and the days this stall is there, which is what ' +
    'tells a farmer packing a van whether it is A12 on Tuesday or F01 on Saturday.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'The stall\'s markets.', content: json(FarmerMarketListRef) },
    401: error('No valid token.'),
    403: error('The account is not a farmer.'),
    404: error('The account is a farmer but has no stall row.'),
  },
});

export function farmersRouter(deps: AppDeps): Router {
  const r = Router();

  /** Every `me` route: a token, an active account, and the farmer role behind it. */
  const asStallOwner = [requireAuth(deps.auth, deps.pool), requireRole('farmer')];

  r.get(
    '/farmers',
    validate({ query: FarmerListQuerySchema }),
    route(async (req, res) => {
      res.json(await listFarmers(deps.pool, req.valid.query as FarmerListQuery));
    }),
  );

  // Ahead of `/farmers/:id`. `me` is not a uuid, so letting the detail route match it first
  // would answer a signed-in farmer with "id is not a uuid".
  r.get(
    '/farmers/me',
    ...asStallOwner,
    route(async (req, res) => {
      res.json(await myStall(deps.pool, currentUser(req).id));
    }),
  );

  r.patch(
    '/farmers/me',
    ...asStallOwner,
    validate({ body: UpdateStallSchema }),
    route(async (req, res) => {
      res.json(await updateStall(deps.pool, currentUser(req).id, req.valid.body as UpdateStallInput));
    }),
  );

  r.post(
    '/farmers/me/geo',
    ...asStallOwner,
    validate({ body: GeoPinSchema }),
    route(async (req, res) => {
      res.json(await pinStall(deps.pool, currentUser(req).id, req.valid.body as GeoPin));
    }),
  );

  r.get(
    '/farmers/me/markets',
    ...asStallOwner,
    route(async (req, res) => {
      res.json(await myStallMarkets(deps.pool, currentUser(req).id));
    }),
  );
  r.put('/farmers/me/markets', ...asStallOwner,
    validate({ body: FarmerMarketAssignmentsSchema }),
    route(async (req, res) => {
      res.json(await saveMyStallMarkets(deps.pool, currentUser(req).id, req.valid.body as { markets: { market_id: string; stall_ref: string | null; days: string[] }[] }));
    }),
  );

  r.get('/farmers/me/insights', ...asStallOwner, route(async (req, res) => {
    const ownerId = currentUser(req).id;
    const { rows: stallRows } = await deps.pool.query('select id,currency from farmers where profile_id=$1', [ownerId]);
    const stall = stallRows[0];
    if (!stall) throw new ApiError('not_found', 'No such farmer stall.');
    const [totals, bestSellers] = await Promise.all([
      deps.pool.query(`select count(*)::int as total_orders,
                              count(*) filter(where status in ('placed','accepted','preparing','ready_for_pickup'))::int as pending_orders,
                              coalesce(sum(subtotal_kobo) filter(where status='completed'),0)::float8 as completed_pickup_value
                         from orders where farmer_id=$1`, [stall.id]),
      deps.pool.query(`select oi.product_name_snapshot as name,sum(oi.quantity)::int as quantity,
                              count(distinct o.id)::int as orders
                         from order_items oi join orders o on o.id=oi.order_id
                        where o.farmer_id=$1 and o.status='completed'
                        group by oi.product_name_snapshot order by quantity desc,name limit 5`, [stall.id]),
    ]);
    res.json({ ...totals.rows[0], currency: stall.currency, best_sellers: bestSellers.rows });
  }));

  r.get('/farmers/me/reviews', ...asStallOwner, route(async (req, res) => {
    res.json(await listFarmerReviews(deps.pool, currentUser(req).id));
  }));
  r.patch('/farmers/me/reviews/:id/reply', ...asStallOwner,
    validate({ params: z.object({ id: FarmerIdParamSchema.shape.id }), body: FarmerReplySchema }),
    route(async (req, res) => {
      res.json(await replyToReview(deps.pool, currentUser(req).id, (req.valid.params as { id: string }).id, (req.valid.body as { body: string }).body));
    }));

  r.get(
    '/farmers/:id',
    validate({ params: FarmerIdParamSchema }),
    route(async (req, res) => {
      const { id } = req.valid.params as { id: string };
      res.json(await farmerDetail(deps.pool, id));
    }),
  );

  return r;
}
