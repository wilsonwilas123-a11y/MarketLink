import { Router } from 'express';
import { registry } from '../api/registry.js';
import {
  ProductCardRef,
  FarmerProductInputSchema,
  ProductIdParamSchema,
  ProductListQuerySchema,
  ProductListRef,
  FarmerProductInputRef,
  FarmerProductRef,
  FarmerProductListRef,
  ProductCategoryListRef,
} from '../api/schemas.js';
import type { FarmerProductInput, ProductListQuery } from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { route } from '../lib/route.js';
import { validate } from '../middleware/validate.js';
import { farmerProducts, listProductCategories, listProducts, productDetail, saveFarmerProduct } from '../services/products.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import type { AppDeps } from '../app.js';
import { ApiError } from '../errors.js';

registry.registerPath({
  method: 'get',
  path: '/products/{id}',
  tags: ['Products'],
  summary: 'Read an active product listing',
  request: { params: ProductIdParamSchema },
  responses: {
    200: { description: 'Product, current stock, farmer and pickup markets.', content: json(ProductCardRef) },
    400: error('`id` is not a uuid.'),
    404: error('No active product on an approved stall has this id.'),
  },
});

registry.registerPath({ method: 'get', path: '/categories', tags: ['Products'], summary: 'List product categories', responses: { 200: { description: 'Categories available for listings.', content: json(ProductCategoryListRef) } } });
registry.registerPath({ method: 'get', path: '/farmers/me/products', tags: ['Products'], summary: 'List the caller’s products and this week’s stock', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Listings owned by the farmer.', content: json(FarmerProductListRef) }, 401: error('Sign in first.'), 403: error('Farmer accounts only.') } });
registry.registerPath({ method: 'delete', path: '/farmers/me/products/{id}', tags: ['Products'], summary: 'Archive one of the caller’s product listings', security: [{ bearerAuth: [] }], request: { params: ProductIdParamSchema }, responses: { 204: { description: 'Listing archived.' }, 404: error('The listing is not owned by the caller.') } });
registry.registerPath({ method: 'post', path: '/farmers/me/products', tags: ['Products'], summary: 'Create a listing and set this week’s stock', security: [{ bearerAuth: [] }], request: { body: { required: true, content: { 'application/json': { schema: FarmerProductInputRef } } } }, responses: { 201: { description: 'Created product.', content: json(FarmerProductRef) }, 400: error('Listing or inventory fields are invalid.') } });
registry.registerPath({ method: 'patch', path: '/farmers/me/products/{id}', tags: ['Products'], summary: 'Edit a listing and update this week’s stock', security: [{ bearerAuth: [] }], request: { params: ProductIdParamSchema, body: { required: true, content: { 'application/json': { schema: FarmerProductInputRef } } } }, responses: { 200: { description: 'Updated product.', content: json(FarmerProductRef) }, 404: error('The listing is not owned by the caller.') } });

registry.registerPath({
  method: 'get',
  path: '/products',
  tags: ['Products'],
  summary: 'Browse active products from approved farmers',
  description:
    'Returns live listings and this week’s stock. Filters can narrow by name, category, market, ' +
    'market day, farmer and price; unavailable products remain visible unless `in_stock_only=true`.',
  request: { query: ProductListQuerySchema },
  responses: {
    200: { description: 'A page of matching products.', content: json(ProductListRef) },
    400: error('A filter is malformed or the minimum price exceeds the maximum.'),
  },
});

export function productsRouter(deps: AppDeps): Router {
  const r = Router();
  const farmerGate = [requireAuth(deps.auth, deps.pool), requireRole('farmer')];

  r.get('/categories', route(async (_req, res) => { res.json(await listProductCategories(deps.pool)); }));
  r.get('/farmers/me/products', ...farmerGate, route(async (req, res) => {
    res.json(await farmerProducts(deps.pool, currentUser(req).id));
  }));
  r.post('/farmers/me/products', ...farmerGate, validate({ body: FarmerProductInputSchema }), route(async (req, res) => {
    res.status(201).json(await saveFarmerProduct(deps.pool, currentUser(req).id, req.valid.body as FarmerProductInput));
  }));
  r.patch('/farmers/me/products/:id', ...farmerGate, validate({ params: ProductIdParamSchema, body: FarmerProductInputSchema }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string };
    res.json(await saveFarmerProduct(deps.pool, currentUser(req).id, req.valid.body as FarmerProductInput, id));
  }));
  r.delete('/farmers/me/products/:id', ...farmerGate, validate({ params: ProductIdParamSchema }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string };
    const result = await deps.pool.query(
      `update products p set is_active=false,updated_at=now()
        from farmers f where p.id=$1 and p.farmer_id=f.id and f.profile_id=$2 and p.is_active
        returning p.id`, [id, currentUser(req).id]);
    if (!result.rowCount) throw new ApiError('not_found', 'That active listing is not on your stall.');
    res.status(204).end();
  }));

  r.get(
    '/products/:id',
    validate({ params: ProductIdParamSchema }),
    route(async (req, res) => {
      const { id } = req.valid.params as { id: string };
      res.json(await productDetail(deps.pool, id));
    }),
  );

  r.get(
    '/products',
    validate({ query: ProductListQuerySchema }),
    route(async (req, res) => {
      res.json(await listProducts(deps.pool, req.valid.query as ProductListQuery));
    }),
  );

  return r;
}
