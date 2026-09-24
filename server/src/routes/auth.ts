import { Router } from 'express';
import { registry } from '../api/registry.js';
import {
  BootstrapSchema,
  BootstrapRef,
  MeRef,
  ProfileRef,
  UpdateMeSchema,
  UpdateMeRef,
  type BootstrapInput,
  type Profile,
  type UpdateMeInput,
} from '../api/schemas.js';
import { error, json } from '../api/responses.js';
import { currentSubject, currentUser, requireAuth, requireSubject } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { route } from '../lib/route.js';
import { bootstrapProfile, readMe, updateMe } from '../services/profile.js';
import type { AppDeps } from '../app.js';

registry.registerPath({
  method: 'post',
  path: '/auth/bootstrap',
  tags: ['Auth'],
  summary: 'Create or refresh the profile behind a signed-up account',
  description:
    'Supabase Auth knows the credentials; this database knows the person. Called once after ' +
    'sign-up, and safe to repeat. A farmer also gets a stall in `pending`, which is what puts ' +
    'them in the admin queue rather than straight onto the public catalogue. `role` accepts ' +
    'only customer and farmer — an admin is promoted in the database, never requested here.',
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(BootstrapRef) } },
  responses: {
    200: { description: 'The caller profile as now stored.', content: json(ProfileRef) },
    400: error('A field is missing, too long, or the role is not self-requestable.'),
    401: error('The bearer token is missing, expired, or invalid.'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/me',
  tags: ['Profile'],
  summary: 'The caller profile, plus the stall they own if any',
  description:
    'The single source of truth for who the client is rendering a dashboard for: the role and ' +
    '`farmer.status` here decide which screens appear, and a farmer in `pending` sees an ' +
    'awaiting-approval notice instead of a stock editor.',
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'Profile and farmer link.', content: json(MeRef) },
    401: error('No valid token, or a token whose account has not been bootstrapped yet.'),
    403: error('The account has been deactivated.'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/me',
  tags: ['Profile'],
  summary: 'Change the caller name, phone, address or avatar',
  description:
    'Partial: a field that is absent is left alone, and `address`/`avatar_url` set to `null` ' +
    'are cleared. Role and active state are not editable here — they belong to an admin.',
  security: [{ bearerAuth: [] }],
  request: { body: { required: true, content: json(UpdateMeRef) } },
  responses: {
    200: { description: 'The updated profile.', content: json(ProfileRef) },
    400: error('No field was supplied, an unknown field was sent, or a value is malformed.'),
    401: error('No valid token.'),
    403: error('The account has been deactivated.'),
  },
});

export function authRouter(deps: AppDeps): Router {
  const r = Router();

  // `requireSubject` rather than `requireAuth`: this is the call that creates the profile
  // row `requireAuth` insists on.
  r.post(
    '/auth/bootstrap',
    requireSubject(deps.auth),
    validate({ body: BootstrapSchema }),
    route(async (req, res) => {
      const profile = await bootstrapProfile(deps.pool, currentSubject(req), req.valid.body as BootstrapInput);
      res.json(profile);
    }),
  );

  r.get(
    '/me',
    requireAuth(deps.auth, deps.pool),
    route(async (req, res) => {
      res.json(await readMe(deps.pool, currentUser(req).id));
    }),
  );

  r.patch(
    '/me',
    requireAuth(deps.auth, deps.pool),
    validate({ body: UpdateMeSchema }),
    route(async (req, res) => {
      const updated = await updateMe(deps.pool, currentUser(req).id, req.valid.body as UpdateMeInput);
      res.json(updated satisfies Profile);
    }),
  );

  return r;
}
