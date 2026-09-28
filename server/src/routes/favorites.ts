import { Router } from 'express';
import { z } from 'zod';
import { registry } from '../api/registry.js';
import { FavoriteListRef, FavoriteRef, FavoriteTargetRef, FavoriteTargetSchema } from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { route } from '../lib/route.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AppDeps } from '../app.js';
import { ApiError } from '../errors.js';

const FavoriteParamsSchema = z.object({ type: z.enum(['farmer', 'product', 'market']), id: z.string().uuid() });

registry.registerPath({ method: 'get', path: '/favorites', tags: ['Favorites'], summary: 'List the customer’s saved markets, farmers, and products', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Saved targets.', content: json(FavoriteListRef) }, 401: error('Sign in first.') } });
registry.registerPath({ method: 'put', path: '/favorites', tags: ['Favorites'], summary: 'Save a market, farmer, or product', security: [{ bearerAuth: [] }], request: { body: { required: true, content: { 'application/json': { schema: FavoriteTargetRef } } } }, responses: { 200: { description: 'Saved target.', content: json(FavoriteRef) }, 404: error('Target is not available.') } });
registry.registerPath({ method: 'delete', path: '/favorites/{type}/{id}', tags: ['Favorites'], summary: 'Remove a saved target', security: [{ bearerAuth: [] }], request: { params: FavoriteParamsSchema }, responses: { 204: { description: 'Favorite removed.' }, 401: error('Sign in first.') } });

export function favoritesRouter(deps: AppDeps): Router {
  const r = Router(); const customer = [requireAuth(deps.auth, deps.pool), requireRole('customer')];
  r.get('/favorites', ...customer, route(async (req, res) => {
    const { rows } = await deps.pool.query(
      `select fav.id,fav.target_type,fav.target_id,fav.created_at::text,
              coalesce(f.stall_name,p.name,m.name) as name,
              coalesce(f.cover_url,p.image_urls[1],m.image_url) as photo_url,
              case fav.target_type when 'farmer' then '/farmers/'||fav.target_id::text when 'market' then '/markets/'||fav.target_id::text else '/products/'||fav.target_id::text end as href
         from favorites fav
         left join farmers f on fav.target_type='farmer' and f.id=fav.target_id
         left join products p on fav.target_type='product' and p.id=fav.target_id
         left join markets m on fav.target_type='market' and m.id=fav.target_id
        where fav.profile_id=$1 order by fav.created_at desc`, [currentUser(req).id]);
    res.json(rows);
  }));
  r.put('/favorites', ...customer, validate({ body: FavoriteTargetSchema }), route(async (req, res) => {
    const { target_type, target_id } = req.valid.body as { target_type: 'farmer' | 'product' | 'market'; target_id: string };
    const target = target_type === 'farmer'
      ? await deps.pool.query(`select stall_name as name,cover_url as photo_url from farmers where id=$1 and status='approved'`, [target_id])
      : target_type === 'product'
        ? await deps.pool.query(`select p.name,p.image_urls[1] as photo_url from products p join farmers f on f.id=p.farmer_id where p.id=$1 and p.is_active and f.status='approved'`, [target_id])
        : await deps.pool.query(`select name,image_url as photo_url from markets where id=$1 and is_active`, [target_id]);
    const row = target.rows[0]; if (!row) throw new ApiError('not_found', 'This listing is no longer available.');
    const result = await deps.pool.query(
      `insert into favorites(profile_id,target_type,target_id) values($1,$2,$3)
       on conflict(profile_id,target_type,target_id) do update set target_id=excluded.target_id
       returning id,target_type,target_id,created_at::text`, [currentUser(req).id, target_type, target_id]);
    res.json({ ...result.rows[0], name: row.name, photo_url: row.photo_url,
      href: target_type === 'farmer' ? `/farmers/${target_id}` : target_type === 'market' ? `/markets/${target_id}` : `/products/${target_id}` });
  }));
  r.delete('/favorites/:type/:id', ...customer, validate({ params: FavoriteParamsSchema }), route(async (req, res) => {
    const { type, id } = req.valid.params as { type: 'farmer' | 'product' | 'market'; id: string };
    await deps.pool.query('delete from favorites where profile_id=$1 and target_type=$2 and target_id=$3', [currentUser(req).id, type, id]);
    res.status(204).end();
  }));
  return r;
}
