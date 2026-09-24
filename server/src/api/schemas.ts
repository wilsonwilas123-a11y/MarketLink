import { registry, z } from './registry.js';

/**
 * The only three roles that exist. Declared here so both the validator and the OpenAPI
 * document read from one definition.
 */
export const RoleSchema = z.enum(['customer', 'farmer', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

/**
 * `admin` is deliberately absent: bootstrap is reachable by any signed-up account, so a
 * role the client can ask for is a role the client can grant itself. Admins are promoted
 * in the database instead.
 */
const RequestableRoleSchema = z.enum(['customer', 'farmer']);

export const BootstrapSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(7).max(20),
  address: z.string().trim().max(240).optional(),
  role: RequestableRoleSchema,
});
export type BootstrapInput = z.infer<typeof BootstrapSchema>;

export const UpdateMeSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    address: z.string().trim().max(240).nullable().optional(),
    avatar_url: z.string().url().max(2048).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to change.' });
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  role: RoleSchema,
  full_name: z.string(),
  phone: z.string(),
  address: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** The stall a farmer owns, if they have one. `null` for customers. */
export const FarmerLinkSchema = z.object({
  id: z.string().uuid(),
  stall_name: z.string(),
  status: z.enum(['pending', 'approved', 'suspended']),
});
export type FarmerLink = z.infer<typeof FarmerLinkSchema>;

export const MeSchema = z.object({
  profile: ProfileSchema,
  farmer: FarmerLinkSchema.nullable(),
});
export type Me = z.infer<typeof MeSchema>;

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['up', 'down']).openapi({
    description: 'Whether `select 1` succeeded. Everything else depends on this.',
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const ErrorSchema = z.object({
  error: z.object({
    code: z.string().openapi({
      example: 'stock_unavailable',
      description: 'A stable machine-readable code. Clients branch on this, not on the message.',
    }),
    message: z.string().openapi({ example: 'Only 3 baskets left for Organic Tomatoes' }),
    details: z.unknown().optional(),
  }),
});

/**
 * Registers a schema as a named component and returns the pointer to it.
 *
 * Routes document with the pointer rather than the schema: the generator inlines a schema
 * at every place it appears, so 60 routes each carrying their own copy of a profile would
 * turn the contract into a 300 KB diff review. `$ref` keeps one definition and makes every
 * endpoint point at it. A name that never got registered fails the validator test.
 */
function component<T extends z.ZodTypeAny>(name: string, schema: T) {
  registry.register(name, schema);
  return { $ref: `#/components/schemas/${name}` } as const;
}

export const ErrorRef = component('Error', ErrorSchema);
export const HealthRef = component('Health', HealthSchema);
export const ProfileRef = component('Profile', ProfileSchema);
export const FarmerLinkRef = component('FarmerLink', FarmerLinkSchema);
export const MeRef = component('Me', MeSchema);
export const BootstrapRef = component('Bootstrap', BootstrapSchema);
export const UpdateMeRef = component('UpdateMe', UpdateMeSchema);
