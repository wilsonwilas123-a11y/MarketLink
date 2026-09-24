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

/**
 * The listing gate (spec 4.3). One definition because both the link on `/me` and the
 * farmer's own stall record report it, and a client that saw two lists of three values
 * would have to guess whether they were the same three.
 */
export const FarmerStatusSchema = z.enum(['pending', 'approved', 'suspended']);
export type FarmerStatus = z.infer<typeof FarmerStatusSchema>;

/** The stall a farmer owns, if they have one. `null` for customers. */
export const FarmerLinkSchema = z.object({
  id: z.string().uuid(),
  stall_name: z.string(),
  status: FarmerStatusSchema,
});
export type FarmerLink = z.infer<typeof FarmerLinkSchema>;

export const MeSchema = z.object({
  profile: ProfileSchema,
  farmer: FarmerLinkSchema.nullable(),
});
export type Me = z.infer<typeof MeSchema>;

/** The seven names `operating_days` arrays hold. Anything else is a typo, not a day. */
export const DaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Day = z.infer<typeof DaySchema>;

/** A day as a client sends it in `?day=`, which arrives as text and has no enum of its own. */
const DayQuerySchema = z.string().trim().toLowerCase().pipe(DaySchema);

const UuidSchema = z.string().uuid();

/**
 * `numeric(9, 6)` arrives from the driver as a string, so every coordinate is read back as
 * a number here. The bounds are the map's, not the validator's: a pin outside them cannot
 * be shown on it.
 */
const LatitudeSchema = z.coerce.number().gt(-90).lt(90).openapi({
  description: 'Decimal degrees. Strictly inside ±90 because the bounding-box maths for ' +
    '"nearby" divides by cos(lat), which is zero at the poles.',
});
const LongitudeSchema = z.coerce.number().min(-180).max(180);

/** `time` columns come back as `HH:MM:SS`; the client only ever prints them. */
const TimeSchema = z.string();

export const PageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export type PageQuery = z.infer<typeof PageSchema>;

const MetaSchema = z.object({
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
});

/**
 * The one list shape (spec 6). `meta.total` counts rows the filter matched, not rows on the
 * page, which is the only way a client can tell "you have seen all four" from "keep paging".
 */
function paged(name: string, item: z.ZodTypeAny) {
  return component(name, z.object({ data: z.array(item), meta: MetaSchema }));
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/** Offset for a page number, with page 1 starting at 0. */
export function offsetFor(page: number, limit: number): number {
  return (page - 1) * limit;
}

export const MarketSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  lat: z.number(),
  lng: z.number(),
  operating_days: z.array(z.string()),
  opens_at: TimeSchema,
  closes_at: TimeSchema,
  image_url: z.string().nullable(),
  is_open_now: z.boolean().openapi({
    description:
      'Whether the market is trading at this moment, read in Africa/Lagos. The timezone is ' +
      'fixed in SQL rather than taken from the server clock, so a deployment in another zone ' +
      'does not move every market open by an hour or eight.',
  }),
});
export type Market = z.infer<typeof MarketSchema>;

/** A market as returned by the distance query. */
export const NearbyMarketSchema = MarketSchema.extend({
  distance_km: z.number().openapi({
    example: 4.82,
    description: 'Straight-line kilometres from the point that was asked about, not a route.',
  }),
});
export type NearbyMarket = z.infer<typeof NearbyMarketSchema>;

/** The stall entries of a market roster: who trades there, and at which pitch. */
export const RosterFarmerSchema = z.object({
  id: UuidSchema,
  stall_name: z.string(),
  contact_person: z.string().nullable(),
  logo_url: z.string().nullable(),
  rating_avg: z.number(),
  rating_count: z.number().int(),
  stall_ref: z.string().nullable(),
  days: z.array(z.string()),
});
export type RosterFarmer = z.infer<typeof RosterFarmerSchema>;

export const MarketDetailSchema = MarketSchema.extend({
  farmers: z.array(RosterFarmerSchema),
  product_count: z.number().int().min(0),
});
export type MarketDetail = z.infer<typeof MarketDetailSchema>;

export const MarketListQuerySchema = PageSchema.extend({
  city: z.string().trim().min(1).max(80).optional(),
  day: DayQuerySchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
  open_now: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type MarketListQuery = z.infer<typeof MarketListQuerySchema>;

export const NearbyQuerySchema = PageSchema.extend({
  lat: LatitudeSchema,
  lng: LongitudeSchema,
  radius_km: z.coerce.number().gt(0).max(200).default(10),
  day: DayQuerySchema.optional(),
  open_now: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type NearbyQuery = z.infer<typeof NearbyQuerySchema>;

export const MarketIdParamSchema = z.object({ id: UuidSchema });
export const FarmerIdParamSchema = z.object({ id: UuidSchema });

export const FarmerSummarySchema = z.object({
  id: UuidSchema,
  stall_name: z.string(),
  contact_person: z.string().nullable(),
  description: z.string().nullable(),
  logo_url: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating_avg: z.number(),
  rating_count: z.number().int(),
  operating_days: z.array(z.string()),
});
export type FarmerSummary = z.infer<typeof FarmerSummarySchema>;

/** A market as listed on a farmer's profile — the stall's own pitch at each one. */
export const FarmerMarketSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  address: z.string(),
  city: z.string(),
  stall_ref: z.string().nullable(),
  days: z.array(z.string()),
});
export type FarmerMarket = z.infer<typeof FarmerMarketSchema>;

/** The in-stock line a public profile shows: enough to buy from, nothing internal. */
export const ListedProductSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  unit: z.string(),
  price_kobo: z.number().int(),
  image_urls: z.array(z.string()),
  is_organic: z.boolean(),
  category: z.object({ id: UuidSchema, name: z.string(), slug: z.string() }),
  quantity_available: z.number().int().nullable(),
  is_sold_out: z.boolean(),
});
export type ListedProduct = z.infer<typeof ListedProductSchema>;

export const ReviewSchema = z.object({
  id: UuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string().nullable(),
  customer_name: z.string(),
  created_at: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const FarmerDetailSchema = FarmerSummarySchema.extend({
  cover_url: z.string().nullable(),
  pickup_window_start: TimeSchema.nullable(),
  pickup_window_end: TimeSchema.nullable(),
  order_cutoff_minutes: z.number().int(),
  markets: z.array(FarmerMarketSchema),
  products: z.array(ListedProductSchema),
  reviews: z.array(ReviewSchema),
});
export type FarmerDetail = z.infer<typeof FarmerDetailSchema>;

/** The caller's own stall, which is the only place `status` is readable by a farmer. */
export const MyStallSchema = z.object({
  id: UuidSchema,
  stall_name: z.string(),
  contact_person: z.string().nullable(),
  description: z.string().nullable(),
  logo_url: z.string().nullable(),
  cover_url: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  operating_days: z.array(z.string()),
  pickup_window_start: TimeSchema.nullable(),
  pickup_window_end: TimeSchema.nullable(),
  order_cutoff_minutes: z.number().int(),
  status: FarmerStatusSchema,
  rating_avg: z.number(),
  rating_count: z.number().int(),
});
export type MyStall = z.infer<typeof MyStallSchema>;

/**
 * A stall edit. `status` is absent on purpose: approval is an admin's decision, and a farmer
 * who could patch it would walk their own stall onto the public catalogue.
 */
export const UpdateStallSchema = z
  .object({
    stall_name: z.string().trim().min(2).max(80).optional(),
    contact_person: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    logo_url: z.string().url().max(2048).nullable().optional(),
    cover_url: z.string().url().max(2048).nullable().optional(),
    operating_days: z.array(DaySchema).max(7).optional(),
    pickup_window_start: TimeSchema.nullable().optional(),
    pickup_window_end: TimeSchema.nullable().optional(),
    order_cutoff_minutes: z.number().int().min(0).max(4320).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to change.' })
  .refine(
    (v) =>
      !v.pickup_window_start ||
      !v.pickup_window_end ||
      v.pickup_window_start < v.pickup_window_end,
    { message: 'The pickup window must open before it closes.', path: ['pickup_window_end'] },
  );
export type UpdateStallInput = z.infer<typeof UpdateStallSchema>;

/** The map picker's whole payload: one pin, both halves of it. */
export const GeoPinSchema = z
  .object({ lat: LatitudeSchema, lng: LongitudeSchema })
  .strict();
export type GeoPin = z.infer<typeof GeoPinSchema>;

export const FarmerListQuerySchema = PageSchema.extend({
  market_id: UuidSchema.optional(),
  category: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().min(1).max(80).optional(),
});
export type FarmerListQuery = z.infer<typeof FarmerListQuerySchema>;

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

export const PageMetaRef = component('PageMeta', MetaSchema);
export const MarketRef = component('Market', MarketSchema);
export const NearbyMarketRef = component('NearbyMarket', NearbyMarketSchema);
export const MarketDetailRef = component('MarketDetail', MarketDetailSchema);
export const FarmerSummaryRef = component('FarmerSummary', FarmerSummarySchema);
export const FarmerDetailRef = component('FarmerDetail', FarmerDetailSchema);
export const MyStallRef = component('MyStall', MyStallSchema);
export const UpdateStallRef = component('UpdateStall', UpdateStallSchema);
export const GeoPinRef = component('GeoPin', GeoPinSchema);
export const MarketListRef = paged('MarketList', MarketSchema);
export const NearbyMarketListRef = paged('NearbyMarketList', NearbyMarketSchema);
export const FarmerListRef = paged('FarmerList', FarmerSummarySchema);
/** Not paged: a stall attends a handful of markets, and the dashboard shows all of them. */
export const FarmerMarketListRef = component('FarmerMarketList', z.array(FarmerMarketSchema));
