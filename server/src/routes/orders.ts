import { Router } from 'express';
import { registry } from '../api/registry.js';
import {
  CreateOrderRef, CreateOrderSchema, OrderIdParamSchema, OrderListQuerySchema,
  OrderListRef, OrderRef, OrderReferenceParamSchema, UpdateOrderStatusSchema, CreateReviewSchema, ModifyOrderItemsSchema,
} from '../api/schemas.js';
import type { CreateOrderInput, CreateReviewInput, OrderListQuery, ModifyOrderItemsInput } from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { route } from '../lib/route.js';
import { currentUser, requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { cancelOrder, getOrder, listOrders, placeOrder, updateOrderStatus, modifyOrderItems } from '../services/orders.js';
import { createReview } from '../services/reviews.js';
import type { AppDeps } from '../app.js';

registry.registerPath({ method: 'post', path: '/orders', tags: ['Orders'], summary: 'Place a pay-at-pickup order', request: { body: { content: { 'application/json': { schema: CreateOrderRef } } } }, responses: { 201: { description: 'Order placed and stock reserved.', content: json(OrderRef) }, 400: error('Pickup, market, or item data is invalid.'), 401: error('Sign in first.'), 409: error('Stock or pickup cutoff is no longer available.') } });
registry.registerPath({ method: 'get', path: '/orders', tags: ['Orders'], summary: 'List the caller’s orders', request: { query: OrderListQuerySchema }, responses: { 200: { description: 'Orders for this customer or farmer.', content: json(OrderListRef) }, 401: error('Sign in first.') } });
registry.registerPath({ method: 'post', path: '/orders/{id}/reviews', tags: ['Reviews'], summary: 'Review a product after completed pickup', security: [{ bearerAuth: [] }], request: { params: OrderIdParamSchema, body: { required: true, content: { 'application/json': { schema: CreateReviewSchema } } } }, responses: { 201: { description: 'Review recorded and ratings refreshed.' }, 400: error('Only products in a completed order can be reviewed.'), 409: error('This product has already been reviewed for that order.') } });
registry.registerPath({ method: 'get', path: '/orders/reference/{reference}', tags: ['Orders'], summary: 'Read an order by reference', security: [{ bearerAuth: [] }], request: { params: OrderReferenceParamSchema }, responses: { 200: { description: 'Order visible to its customer or assigned farmer.' }, 404: error('Order not found.') } });
registry.registerPath({ method: 'post', path: '/orders/{id}/cancel', tags: ['Orders'], summary: 'Cancel before the pickup cutoff', security: [{ bearerAuth: [] }], request: { params: OrderIdParamSchema }, responses: { 200: { description: 'Order cancelled and reserved stock restored.' }, 409: error('The order cannot be cancelled now.') } });
registry.registerPath({ method: 'patch', path: '/orders/{id}/items', tags: ['Orders'], summary: 'Modify order items before pickup cutoff', security: [{ bearerAuth: [] }], request: { params: OrderIdParamSchema, body: { required: true, content: { 'application/json': { schema: ModifyOrderItemsSchema } } } }, responses: { 200: { description: 'Items updated and reserved stock adjusted atomically.' }, 409: error('The pickup cutoff has passed or stock changed.') } });
registry.registerPath({ method: 'patch', path: '/orders/{id}/status', tags: ['Orders'], summary: 'Advance a farmer pickup order', security: [{ bearerAuth: [] }], request: { params: OrderIdParamSchema, body: { required: true, content: { 'application/json': { schema: UpdateOrderStatusSchema } } } }, responses: { 200: { description: 'Order status changed.' }, 409: error('Invalid order status transition.') } });

export function ordersRouter(deps: AppDeps): Router {
  const r = Router();
  const authenticated = requireAuth(deps.auth, deps.pool);
  r.post('/orders', authenticated, requireRole('customer'), validate({ body: CreateOrderSchema }), route(async (req, res) => {
    res.status(201).json(await placeOrder(deps.pool, currentUser(req).id, req.valid.body as CreateOrderInput));
  }));
  r.post('/orders/:id/reviews', authenticated, requireRole('customer'), validate({ params: OrderIdParamSchema, body: CreateReviewSchema }), route(async (req, res) => {
    res.status(201).json(await createReview(deps.pool, currentUser(req).id, (req.valid.params as { id: string }).id, req.valid.body as CreateReviewInput));
  }));
  r.get('/orders', authenticated, validate({ query: OrderListQuerySchema }), route(async (req, res) => {
    const user = currentUser(req);
    res.json(await listOrders(deps.pool, user.id, user.role, req.valid.query as OrderListQuery));
  }));
  r.get('/orders/reference/:reference', authenticated, validate({ params: OrderReferenceParamSchema }), route(async (req, res) => {
    const user = currentUser(req);
    res.json(await getOrder(deps.pool, (req.valid.params as { reference: string }).reference, user.id, user.role));
  }));
  r.post('/orders/:id/cancel', authenticated, requireRole('customer'), validate({ params: OrderIdParamSchema }), route(async (req, res) => {
    res.json(await cancelOrder(deps.pool, (req.valid.params as { id: string }).id, currentUser(req).id));
  }));
  r.patch('/orders/:id/items', authenticated, requireRole('customer'), validate({ params: OrderIdParamSchema, body: ModifyOrderItemsSchema }), route(async (req, res) => {
    res.json(await modifyOrderItems(deps.pool, (req.valid.params as { id: string }).id, currentUser(req).id, req.valid.body as ModifyOrderItemsInput));
  }));
  r.patch('/orders/:id/status', authenticated, requireRole('farmer'), validate({ params: OrderIdParamSchema, body: UpdateOrderStatusSchema }), route(async (req, res) => {
    const body = req.valid.body as { status: 'accepted' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled' };
    res.json(await updateOrderStatus(deps.pool, (req.valid.params as { id: string }).id, currentUser(req).id, body.status));
  }));
  return r;
}
