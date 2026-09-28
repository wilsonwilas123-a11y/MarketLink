import { Router } from 'express';
import { z } from 'zod';
import { registry } from '../api/registry.js';
import { error, json } from '../api/responses.js';
import { NotificationListRef } from '../api/schemas.js';
import { ApiError } from '../errors.js';
import { route } from '../lib/route.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { AppDeps } from '../app.js';

registry.registerPath({ method: 'get', path: '/notifications', tags: ['Notifications'], summary: 'Read signed-in user notifications', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Recent notifications, newest first.', content: json(NotificationListRef) }, 401: error('Sign in first.') } });
registry.registerPath({ method: 'patch', path: '/notifications/{id}/read', tags: ['Notifications'], summary: 'Mark one notification as read', security: [{ bearerAuth: [] }], request: { params: z.object({ id: z.string().uuid() }) }, responses: { 200: { description: 'Notification marked read.' }, 404: error('Notification not found.') } });
registry.registerPath({ method: 'post', path: '/notifications/read-all', tags: ['Notifications'], summary: 'Mark all notifications as read', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Read count returned.' } } });
export function notificationsRouter(deps: AppDeps): Router {
  const r = Router(); const auth = requireAuth(deps.auth, deps.pool);
  r.get('/notifications', auth, route(async (req, res) => {
    const { rows } = await deps.pool.query(`select id,kind,title,body,link,read_at::text,created_at::text from notifications where profile_id=$1 order by created_at desc limit 100`, [currentUser(req).id]);
    res.json(rows);
  }));
  r.patch('/notifications/:id/read', auth, validate({ params: z.object({ id: z.string().uuid() }) }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string };
    const { rows } = await deps.pool.query(`update notifications set read_at=coalesce(read_at,now()) where id=$1 and profile_id=$2 returning id,read_at::text`, [id,currentUser(req).id]);
    if (!rows[0]) throw new ApiError('not_found', 'No such notification.'); res.json(rows[0]);
  }));
  r.post('/notifications/read-all', auth, route(async (req, res) => {
    const result = await deps.pool.query(`update notifications set read_at=now() where profile_id=$1 and read_at is null`, [currentUser(req).id]);
    res.json({ updated: result.rowCount ?? 0 });
  }));
  return r;
}
