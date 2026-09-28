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
  address: z.string().trim().min(1, 'Enter your address or the area where you shop.').max(240),
  role: RequestableRoleSchema,
  stall_name: z.string().trim().min(2).max(80).optional(),
  country: z.enum([
    'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Senegal', "Côte d'Ivoire", 'Cameroon',
    'Uganda', 'Tanzania', 'Rwanda', 'Egypt', 'Morocco', 'Ethiopia', 'Botswana', 'Zambia', 'Mozambique',
  ]).optional(),
}).strict().superRefine((value, context) => {
  if (value.role === 'farmer' && !value.stall_name) {
    context.addIssue({ code: 'custom', path: ['stall_name'], message: 'Enter your stall or farm business name.' });
  }
  if (value.role === 'farmer' && !value.country) {
    context.addIssue({ code: 'custom', path: ['country'], message: 'Choose the country where your farm or stall operates.' });
  }
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
  currency: z.string().length(3),
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
  /** The stall's banner. Listed screens draw a card with it, so it cannot live only on the profile. */
  cover_url: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating_avg: z.number(),
  rating_count: z.number().int(),
  currency: z.string().length(3),
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
  price_minor: z.number().int(),
  image_urls: z.array(z.string()),
  is_organic: z.boolean(),
  category: z.object({ id: UuidSchema, name: z.string(), slug: z.string() }),
  quantity_available: z.number().int().nullable(),
  is_sold_out: z.boolean(),
});
export type ListedProduct = z.infer<typeof ListedProductSchema>;

export const ProductMarketSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  city: z.string(),
  days: z.array(z.string()),
  opens_at: TimeSchema,
  closes_at: TimeSchema,
});

export const ProductCardSchema = ListedProductSchema.extend({
  description: z.string().nullable(),
  farmer: z.object({
    id: UuidSchema,
    stall_name: z.string(),
    rating_avg: z.number(),
    rating_count: z.number().int(),
    currency: z.string().length(3),
    operating_days: z.array(z.string()),
    pickup_window_start: TimeSchema.nullable(),
    pickup_window_end: TimeSchema.nullable(),
    order_cutoff_minutes: z.number().int(),
  }),
  markets: z.array(ProductMarketSchema),
});
export type ProductCard = z.infer<typeof ProductCardSchema>;

export const ProductListQuerySchema = PageSchema.extend({
  q: z.string().trim().min(1).max(80).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  market_id: UuidSchema.optional(),
  farmer_id: UuidSchema.optional(),
  day: DayQuerySchema.optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  min_price_minor: z.coerce.number().int().min(0).optional(),
  max_price_minor: z.coerce.number().int().min(0).optional(),
  in_stock_only: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  sort: z.enum(['popular', 'price_low', 'price_high', 'newest']).default('popular'),
}).refine(
  (query) => query.min_price_minor === undefined || query.max_price_minor === undefined ||
    query.min_price_minor <= query.max_price_minor,
  { message: 'Minimum price must not exceed maximum price.' },
).refine(
  (query) => query.currency !== undefined ||
    (query.min_price_minor === undefined && query.max_price_minor === undefined &&
      query.sort !== 'price_low' && query.sort !== 'price_high'),
  { message: 'Select a currency before filtering or sorting by price.' },
);
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export const ProductIdParamSchema = z.object({ id: UuidSchema });
export const FavoriteTargetSchema = z.object({ target_type: z.enum(['farmer', 'product', 'market']), target_id: UuidSchema }).strict();
export const AdminMarketInputSchema = z.object({
  name: z.string().trim().min(2).max(120), address: z.string().trim().max(300),
  city: z.string().trim().min(1).max(80), state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(2).max(80), currency: z.string().trim().regex(/^[A-Z]{3}$/),
  timezone: z.string().trim().regex(/^[A-Za-z]+\/[A-Za-z_-]+$/),
  lat: LatitudeSchema, lng: LongitudeSchema,
  operating_days: z.array(DaySchema).min(1).max(7).refine((days) => new Set(days).size === days.length),
  opens_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closes_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  image_url: z.string().url().nullable(), is_active: z.boolean(),
}).strict().refine((value) => value.opens_at < value.closes_at, { message: 'Market closing time must be after opening time.', path: ['closes_at'] });
export const MarketRosterInputSchema = z.object({
  farmer_id: UuidSchema,
  stall_ref: z.string().trim().max(40).nullable().optional(),
  days: z.array(DaySchema).min(1).max(7).refine((value) => new Set(value).size === value.length),
}).strict();
export const FarmerMarketAssignmentsSchema = z.object({
  markets: z.array(z.object({
    market_id: UuidSchema,
    stall_ref: z.string().trim().max(40).nullable(),
    days: z.array(DaySchema).min(1).max(7).refine((value) => new Set(value).size === value.length),
  }).strict()).max(30).refine((markets) => new Set(markets.map((market) => market.market_id)).size === markets.length),
}).strict();
export const FarmerMarketAssignmentsRef = component('FarmerMarketAssignments', FarmerMarketAssignmentsSchema);
export const NotificationSchema = z.object({
  id: UuidSchema, kind: z.string(), title: z.string(), body: z.string(), link: z.string().nullable(),
  read_at: z.string().nullable(), created_at: z.string(),
});
export const FavoriteSchema = z.object({
  id: UuidSchema, target_type: z.enum(['farmer', 'product', 'market']), target_id: UuidSchema,
  name: z.string(), photo_url: z.string().nullable(), href: z.string(), created_at: z.string(),
});
export const FarmerProductInputSchema = z.object({
  category_id: UuidSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  unit: z.enum(['basket', 'bunch', 'pack', 'crate', 'l', 'kg']),
  price_minor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  image_urls: z.array(z.string().url().max(2048)).max(5).default([]),
  is_organic: z.boolean().default(false),
  /** Stock to make available automatically in a new week; this week's quantity remains editable separately. */
  template_qty: z.number().int().min(0).max(100000).optional(),
  quantity_available: z.number().int().min(0).max(100000),
  is_sold_out: z.boolean().default(false),
}).strict().refine((value) => !value.is_sold_out || value.quantity_available === 0, {
  message: 'A sold-out listing must have zero available quantity.', path: ['quantity_available'],
});
export type FarmerProductInput = z.infer<typeof FarmerProductInputSchema>;
export const ProductCategorySchema = z.object({ id: UuidSchema, name: z.string(), slug: z.string() });
export const FarmerProductSchema = z.object({
  id: UuidSchema, name: z.string(), description: z.string().nullable(), category_id: UuidSchema,
  category_name: z.string(), category_slug: z.string(), unit: z.string(), price_minor: z.number().int(),
  image_urls: z.array(z.string()), is_organic: z.boolean(), is_active: z.boolean(),
  template_qty: z.number().int(), quantity_available: z.number().int(), is_sold_out: z.boolean(),
});

export const OrderStatusSchema = z.enum([
  'placed', 'accepted', 'preparing', 'ready_for_pickup', 'completed', 'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CreateOrderSchema = z.object({
  market_id: UuidSchema,
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid pickup date.'),
  pickup_slot_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  pickup_slot_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  items: z.array(z.object({ product_id: UuidSchema, quantity: z.number().int().min(1).max(100) })).min(1).max(30),
}).strict().refine(
  (value) => value.pickup_slot_start < value.pickup_slot_end,
  { message: 'Pickup slot end must be after its start.' },
).refine(
  (value) => new Set(value.items.map((item) => item.product_id)).size === value.items.length,
  { message: 'A product can appear only once in an order.' },
);
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/** Replacement item quantities for an unpaid pickup order before its cutoff. */
export const ModifyOrderItemsSchema = z.object({
  items: z.array(z.object({ product_id: UuidSchema, quantity: z.number().int().min(1).max(100) })).min(1).max(30),
}).strict().refine(
  (value) => new Set(value.items.map((item) => item.product_id)).size === value.items.length,
  { message: 'A product can appear only once in an order.' },
);
export type ModifyOrderItemsInput = z.infer<typeof ModifyOrderItemsSchema>;

export const OrderListQuerySchema = PageSchema.extend({
  status: OrderStatusSchema.optional(),
  scope: z.enum(['today']).optional(),
});
export type OrderListQuery = z.infer<typeof OrderListQuerySchema>;

export const OrderItemSchema = z.object({
  product_id: UuidSchema,
  name: z.string(),
  unit: z.string(),
  price_minor: z.number().int(),
  quantity: z.number().int().positive(),
  reviewed: z.boolean(),
});

export const OrderSchema = z.object({
  id: UuidSchema,
  reference: z.string(),
  status: OrderStatusSchema,
  subtotal_minor: z.number().int().nonnegative(),
  delivery_fee_minor: z.literal(0),
  currency: z.string().length(3),
  pickup_date: z.string(),
  pickup_slot_start: TimeSchema,
  pickup_slot_end: TimeSchema,
  cutoff_at: z.string(),
  placed_at: z.string(),
  accepted_at: z.string().nullable(),
  ready_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  cancelled_at: z.string().nullable(),
  farmer: z.object({ id: UuidSchema, stall_name: z.string() }),
  market: z.object({ id: UuidSchema, name: z.string(), address: z.string(), city: z.string(), lat: LatitudeSchema, lng: LongitudeSchema }),
  items: z.array(OrderItemSchema),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderIdParamSchema = z.object({ id: UuidSchema });
export const OrderReferenceParamSchema = z.object({ reference: z.string().trim().min(1).max(40) });
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['accepted', 'preparing', 'ready_for_pickup', 'completed', 'cancelled']),
}).strict();
export const CreateReviewSchema = z.object({
  product_id: UuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).nullable().optional(),
  body: z.string().trim().max(1000).nullable().optional(),
}).strict();
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export const FarmerReplySchema = z.object({ body: z.string().trim().min(2).max(1000) }).strict();

export const ReviewSchema = z.object({
  id: UuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string().nullable(),
  farmer_reply: z.string().nullable().optional(),
  customer_name: z.string(),
  created_at: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const FarmerDetailSchema = FarmerSummarySchema.extend({
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
  currency: z.string().length(3),
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

/**
 * A place search.
 *
 * Three characters is the floor because gazetteers answer short strings with the whole world:
 * `kad` returns a ward in Slovakia as readily as a city in Nigeria, and a caller who meant the
 * latter learns nothing from the former.
 */
export const GeoSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(80),
  limit: z.coerce.number().int().min(1).max(50).default(5),
});
export type GeoSearchQuery = z.infer<typeof GeoSearchQuerySchema>;

/**
 * A corner of the map, asked of the market list.
 *
 * The schema checks the shape and nothing else, because the rest of the rules — north above
 * south, inside the world, small enough to ask a volunteer mirror for — read the four numbers
 * together rather than one at a time, and those live with the upstream call in `parseMarketBox`.
 * Splitting them would put the same limit in two places and let them disagree.
 */
export const MarketBoxQuerySchema = z.object({
  bbox: z
    .string()
    .regex(/^-?\d{1,3}(?:\.\d{1,6})?(?:\s*,\s*-?\d{1,3}(?:\.\d{1,6})?){3}$/, {
      message: 'bbox has to be four numbers: south,west,north,east.',
    }),
  limit: z.coerce.number().int().min(1).max(50).default(6),
});
export type MarketBoxQuery = z.infer<typeof MarketBoxQuerySchema>;

/**
 * One candidate pin, as OpenStreetMap described the place.
 *
 * `ref` is the element's own OSM reference, which is what lets a human open the source and
 * check the dot before trusting it. `address` is assembled from whatever parts the gazetteer
 * happened to have, so it is a label for a person to choose between results, not a field to
 * store: a market row's address is written by whoever adds the market.
 *
 * `image_url` never comes from OpenStreetMap — it carries no photos — so it is filled in
 * afterwards, best-effort, from a name-matched Commons file or a labeled regional fallback.
 */
export const PlaceCandidateSchema = z.object({
  ref: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  address: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.string().openapi({
    description: 'The OpenStreetMap tag pair, such as `amenity/marketplace`.',
  }),
  image_url: z.string().nullable().openapi({
    description: 'A thumbnail from a relevant Wikimedia Commons file, either matched to this market or a labeled regional fallback; null when neither is available.',
  }),
  image_credit: z.string().nullable().openapi({ description: 'Visible credit for the photo source.' }),
  image_link: z.string().url().nullable().openapi({ description: 'Source page linked beside the photo.' }),
  image_kind: z.enum(['exact', 'regional']).nullable(),
  image_region: z.string().nullable(),
});
export type PlaceCandidate = z.infer<typeof PlaceCandidateSchema>;

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
/** Not paged: a place search returns a handful of candidates and no second page. */
export const PlaceCandidateListRef = component('PlaceCandidateList', z.array(PlaceCandidateSchema));
export const MarketListRef = paged('MarketList', MarketSchema);
export const NearbyMarketListRef = paged('NearbyMarketList', NearbyMarketSchema);
export const FarmerListRef = paged('FarmerList', FarmerSummarySchema);
export const ProductListRef = paged('ProductList', ProductCardSchema);
export const CreateOrderRef = component('CreateOrder', CreateOrderSchema);
export const OrderRef = component('Order', OrderSchema);
export const OrderListRef = paged('OrderList', OrderSchema);
export const ProductCardRef = component('ProductCard', ProductCardSchema);
export const FarmerProductInputRef = component('FarmerProductInput', FarmerProductInputSchema);
export const FarmerProductRef = component('FarmerProduct', FarmerProductSchema);
export const FarmerProductListRef = component('FarmerProductList', z.array(FarmerProductSchema));
export const ProductCategoryListRef = component('ProductCategoryList', z.array(ProductCategorySchema));
export const FavoriteRef = component('Favorite', FavoriteSchema);
export const FavoriteListRef = component('FavoriteList', z.array(FavoriteSchema));
export const FavoriteTargetRef = component('FavoriteTarget', FavoriteTargetSchema);
export const ProductImageUploadResponseRef = component('ProductImageUploadResponse', z.object({ url: z.string().url() }));
export const NotificationListRef = component('NotificationList', z.array(NotificationSchema));
/** Not paged: a stall attends a handful of markets, and the dashboard shows all of them. */
export const FarmerMarketListRef = component('FarmerMarketList', z.array(FarmerMarketSchema));
