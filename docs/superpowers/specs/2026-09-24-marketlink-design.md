# MarketLink — Design Specification

**Version:** 1.0
**Date:** 2026-09-24
**Theme:** eGreen Basket · End-to-End Web Solutions
**Status:** Approved for implementation planning

---

## 1. Summary

MarketLink is a full-stack web application connecting local farmers-market vendors with
customers. Farmers publish weekly stock, pricing, and pickup windows; customers discover
nearby markets on a map, browse availability, reserve items for pickup, and leave feedback.

Payment is **out of scope**. Orders are settled in person at the market stall.

The build is divided into **20 phases**, each ending in a runnable, demoable state.

### What was decided before this spec

| Question | Decision |
|---|---|
| Supabase vs Node split | Node owns all business logic. Client never queries the database directly. |
| Maps | OpenStreetMap raster tiles via Leaflet. No API key, no billing. |
| AI assistant | Rule-based intent + keyword matcher over the app's own data. No LLM API. |
| Database access during build | Migrations and seed SQL are written by us; the user applies them in the Supabase dashboard. |
| Checkout UI | Mockup screen 6 shows card/bank/cash options. Replaced with a single **pay-at-pickup** tile, because the SRS forbids payment functionality. |
| Currency | Nigerian Naira (₦), stored as integers in kobo. |
| Payment gateway | **Flutterwave considered and rejected.** SRS §1.5 and §1.6 both forbid payment functionality; orders settle at pickup. Named in the README as a future extension only. |
| Multi-farmer cart | Split at checkout into one order per farmer — see 4.14. |
| Version control | `git init` in phase 1, one commit per phase, `ocr` review of each diff. |
| API contract | `openapi.json` generated from the zod schemas in phase 3, scored in phase 20. |
| Convention freeze | `init-pipeline` runs after phase 8, once backend **and** frontend patterns exist. |

---

## 2. Goals and Non-Goals

### Goals

- Farmers can register, publish weekly inventory with photos and prices, and manage incoming pre-orders.
- Customers can find markets near them, see what is actually in stock, and reserve it for a pickup slot.
- Both roles get an interactive dashboard; an admin role manages approvals, markets, and moderation.
- Responsive, accessible, dark-green visual system matching the approved mockups.
- Runs on free tiers only: Supabase (DB/auth/storage), Vercel or Netlify (client), Render or Railway (Node API).

### Non-Goals

- No payments, wallets, refunds, or invoicing.
- No delivery or courier logistics — market pickup only.
- No identity, licensing, or organic-certification verification of farmers.
- No native mobile apps.
- No real-time chat between farmer and customer.
- No LLM dependency.

---

## 3. Architecture

### 3.1 Repository layout

```
marketlink/
  package.json          # npm workspaces root, "npm run dev" starts both
  .env.example
  docs/
    superpowers/specs/
  db/
    migrations/         # numbered SQL, applied manually to Supabase
    seed/               # Lagos demo data
  client/               # Vite + React + TypeScript
    src/
      api/              # typed fetch wrappers, one module per resource
      auth/             # supabase-js session context
      components/       # shared UI primitives
      features/         # by domain: markets, products, orders, cart, dashboard, admin
      layouts/
      pages/
      styles/           # Tailwind theme tokens
      routes.tsx
  server/               # Express + TypeScript
    src/
      config/           # env parsing, validation at boot
      lib/              # pg pool, supabase admin client, logger
      middleware/       # auth, rbac, validation, error handler, request id
      routes/           # one router per resource
      services/         # business logic, unit-testable, no HTTP types
      errors.ts
```

Two packages, one repo. The client imports nothing from the server; the contract is the
JSON API described in section 6.

### 3.2 Runtime topology

```
Browser (React SPA)
   │
   ├── sign-up / log-in ──────────────► Supabase Auth  ──► JWT
   │
   ├── GET/POST /api/**  (Bearer JWT) ─► Node/Express API
   │                                        │  service-role key (server env only)
   │                                        ├──► Postgres (Supabase) — pg driver, parameterised SQL
   │                                        └──► Supabase Storage — product images
   │
   └── <img src> ─────────────────────► Supabase Storage public bucket
```

- **Node is stateless.** No sessions, no in-memory cart. Any instance can serve any request.
- **The service-role key never reaches the browser.** It lives in `server/.env`, and the
  client bundle is checked at build time for accidental leakage.
- **RLS is enabled on every table** as defence in depth, denying all direct client access;
  all legitimate traffic is routed through Node's service-role connection.

### 3.3 Why this shape

Supabase gives auth and storage for free, which removes two of the most failure-prone
hand-rolled components from a hackathon build. Putting every business rule in Node keeps
one source of truth for order state, stock, and cutoff logic, and gives a clean answer when
judges ask how the pre-order flow works.

---

## 4. Data Model

Eleven tables. Timestamps are `timestamptz`, primary keys `uuid`, money in kobo `bigint`.

### 4.1 `profiles`

Extends `auth.users`. One row per account.

| column | type | notes |
|---|---|---|
| id | uuid | FK → `auth.users.id`, PK |
| role | text | `customer` \| `farmer` \| `admin` |
| full_name | text | |
| phone | text | required at registration |
| address | text | |
| avatar_url | text | nullable |
| is_active | boolean | admin deactivation switch, default true |
| created_at / updated_at | timestamptz | |

### 4.2 `markets`

Admin-managed farmers markets.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| address | text | |
| city | text | |
| state | text | |
| lat / lng | numeric(9,6) | map pin |
| operating_days | text[] | e.g. `{sat,sun}` |
| opens_at / closes_at | time | |
| image_url | text | |
| is_active | boolean | |

### 4.3 `farmers`

A vendor stall. Belongs to a customer-role-eligible profile promoted to `farmer`.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| profile_id | uuid | FK → profiles |
| stall_name | text | |
| contact_person | text | |
| description | text | |
| logo_url / cover_url | text | |
| lat / lng | numeric(9,6) | stall or pickup pin |
| operating_days | text[] | |
| pickup_window_start / end | time | |
| order_cutoff_minutes | int | hours before pickup slot that ordering closes, default 120 |
| status | text | `pending` \| `approved` \| `suspended` |
| rating_avg | numeric(3,2) | denormalised, recomputed on review write |
| rating_count | int | |

`status` gates listing: only `approved` farmers appear publicly or can publish stock.

### 4.4 `market_farmers`

Many-to-many join: which stall sells at which market, and where within it.

`market_id`, `farmer_id`, `stall_ref` (text, e.g. "A12"), `days text[]`. Composite PK on
(`market_id`, `farmer_id`).

### 4.5 `categories`

Admin-managed master data: Vegetables, Fruits, Dairy, Bakery, Herbs.

`id`, `name` (unique), `slug`, `icon_key`, `sort_order`.

### 4.6 `products`

A Farmer's listing. The recurring weekly template lives here.

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| farmer_id | uuid | FK → farmers |
| category_id | uuid | FK → categories |
| name | text | |
| description | text | |
| unit | text | `basket` \| `bunch` \| `pack` \| `crate` \| `l` \| `kg` |
| price_kobo | bigint | |
| image_urls | text[] | Storage paths, first is the card image |
| template_qty | int | recurring weekly stock quantity |
| is_organic | boolean | |
| is_active | boolean | admin moderation switch |
| rating_avg / rating_count | numeric / int | |

### 4.7 `weekly_stock`

Per-product availability for one ISO week. This is what the "12 baskets left" badge reads.

| column | type | notes |
|---|---|---|
| product_id | uuid | FK, part of PK |
| week | text | ISO week, e.g. `2026-W39`, part of PK |
| quantity_available | int | `CHECK (quantity_available >= 0)` |
| is_sold_out | boolean | farmer's manual override |
| updated_at | timestamptz | |

**Availability rule:** a product is orderable when `is_active`, its farmer is `approved`,
`is_sold_out = false`, and `quantity_available > 0` for the current week.

`POST /api/farmers/me/stock/reset` copies `template_qty` into the current week's rows so a
farmer restores the whole week in one tap, then edits individual lines.

### 4.8 `orders`

| column | type | notes |
|---|---|---|
| id | uuid | PK |
| reference | text | unique, `ML-2048` style, shown to customers |
| customer_id | uuid | FK → profiles |
| farmer_id | uuid | FK → farmers — **one farmer per order** |
| market_id | uuid | FK → markets, where pickup happens |
| status | text | see 4.10 |
| subtotal_kobo | bigint | |
| pickup_date | date | |
| pickup_slot_start / end | time | must fall inside the farmer's window and market hours |
| cutoff_at | timestamptz | computed at insert: `pickup_date + pickup_slot_start − order_cutoff_minutes` |
| placed_at / accepted_at / ready_at / completed_at / cancelled_at | timestamptz | |
| cancel_reason | text | |
| delivery_fee_kobo | bigint | always 0; column exists so the checkout's "Delivery/Pickup: Free" line is real data |

### 4.9 `order_items`

`order_id`, `product_id`, `product_name_snapshot`, `unit_snapshot`, `price_kobo_snapshot`,
`quantity`. `quantity > 0`. Snapshots keep history truthful when a farmer later edits a price.

### 4.10 Order status machine

```
placed ──► accepted ──► preparing ──► ready_for_pickup ──► completed
   │           │
   └───────────┴──────────► cancelled
```

| Transition | Who | Condition |
|---|---|---|
| → placed | customer | stock available, slot valid, before cutoff |
| placed → accepted / cancelled | farmer | always allowed |
| accepted → preparing → ready_for_pickup → completed | farmer | forward only, one step at a time |
| placed / accepted → cancelled | customer | only while `now() < cutoff_at` |
| ready_for_pickup → cancelled | — | blocked; the goods are packed |

Every transition is validated in the service layer, not the UI. Cancelling or a farmer
declining **returns the quantity to `weekly_stock`** in the same transaction.

### 4.11 `reviews`

`id`, `order_id`, `product_id`, `farmer_id`, `customer_id`, `rating int CHECK 1..5`,
`title`, `body`, `farmer_reply text`, `replied_at`, `status text default 'visible'`
(`visible` \| `removed` — admin moderation). A customer may review only a `completed`
order, once per product in that order.

### 4.12 `favorites`

`profile_id`, `target_type text` (`farmer` \| `product`), `target_id`. Unique on the triple.

### 4.13 `notifications`

`id`, `profile_id`, `kind text` (`order_placed`, `order_accepted`, `order_ready`,
`order_cancelled`, `stock_low`, `announcement`), `title`, `body`, `link`, `read_at`,
`created_at`.

### 4.14 Cart location

The cart is **client state only** (`localStorage`, TanStack Query persistence). It is a
shopping aid, not a reservation — stock is committed at checkout. This avoids abandoned
carts locking inventory, which is the fastest way to make a farmers-market app lie about
availability.

**Multi-farmer carts:** because a pickup happens at one stall in one market, an order
carries exactly one `farmer_id`. A cart mixing lines from several farmers is **split at
checkout into one order per farmer**, each with its own market, pickup slot, cutoff, and
reference. `POST /orders` therefore accepts a single farmer's lines plus that farmer's
chosen slot; the client calls it once per group and reports partial success if one group
fails on stock while another commits. The checkout UI shows the groups as separate pickup
cards so the split is visible, not surprising.

---

## 5. Authentication and Authorization

### 5.1 Sign-up

1. Client collects name, phone, e-mail, password, and role (customer or farmer).
2. `supabase.auth.signUp()` creates `auth.users`.
3. On the first authenticated call, Node upserts the matching `profiles` row. Role is
   written from a server-side allowlist; the client cannot request `admin`.
4. Farmer accounts additionally create a `farmers` row in `status = 'pending'` and cannot
   list products until an admin approves.

### 5.2 Request authentication

Every `/api/**` request carries `Authorization: Bearer <jwt>`. `requireAuth` calls
`supabaseAdmin.auth.getUser(token)`; on success it attaches `{ id, role, isActive }` to
`req.user`. A deactivated profile is rejected with `403 account_disabled`.

### 5.3 Role gates

`requireRole('farmer')`, `requireRole('admin')` as route middleware. Ownership is checked in
the service layer by comparing `farmer_id.profile_id` to `req.user.id` — a farmer who edits
the URL to another farmer's `/stock` gets `403`, not someone else's inventory.

### 5.4 Public routes

`GET /api/markets`, `/api/markets/nearby`, `/api/farmers`, `/api/products`, and their detail
endpoints work unauthenticated so the landing page and discovery screens load for visitors.
Cart writes, orders, favorites, reviews, and all dashboard endpoints require auth.

---

## 6. API Surface

All under `/api`. Errors follow section 9. Pagination: `?page=1&limit=24`, response
`{ data, meta: { total, page, limit } }`.

### Auth & profile
```
POST   /auth/bootstrap              upsert profile after supabase signup
GET    /me                          profile + role + farmer link if any
PATCH  /me                          name, phone, address, avatar
```

### Markets
```
GET    /markets                     ?city=&day=&q=
GET    /markets/nearby              ?lat=&lng=&radius_km=10  → sorted by distance
GET    /markets/:id                 detail + farmer roster + product count
```

### Farmers
```
GET    /farmers                     ?market_id=&category=&q=
GET    /farmers/:id                 profile, markets, this week's products, reviews
GET    /farmers/me                  own record incl. pending status
PATCH  /farmers/me                  stall details, pin, days, pickup window, cutoff
POST   /farmers/me/geo              set lat/lng from the map picker
GET    /farmers/me/markets          which markets this stall attends
```

### Products & stock
```
GET    /products                    ?category_id=&farmer_id=&market_id=&q=&min_price=&max_price=
                                    &in_stock=true&organic=true&sort=popular|price_asc|price_desc|newest
GET    /products/:id                + this week's stock + farmer summary
POST   /products                    farmer
PATCH  /products/:id                farmer
DELETE /products/:id                farmer (soft: is_active=false)
GET    /farmers/me/stock?week=2026-W39
PUT    /farmers/me/stock            upsert quantity / sold-out for a week
POST   /farmers/me/stock/reset      copy template_qty into the current week
POST   /uploads                     multipart → Supabase Storage, returns public URL
GET    /categories                  public
```

### Orders
```
POST   /orders                      from cart; atomic, see 6.1
GET    /orders                      customer: own history; farmer: incoming, ?status=&scope=today
GET    /orders/:reference           detail with timeline for tracking page
PATCH  /orders/:id/status           farmer: accept / decline / preparing / ready / complete
POST   /orders/:id/cancel           customer, before cutoff
PATCH  /orders/:id                  customer, before cutoff: quantity and pickup slot only
```

#### 6.1 `POST /orders` — the one transaction that matters

```
BEGIN
  for each line:
    UPDATE weekly_stock
       SET quantity_available = quantity_available - :qty
     WHERE product_id = :pid AND week = :week
       AND is_sold_out = false
       AND quantity_available >= :qty
    → if 0 rows affected: ROLLBACK, 409 stock_unavailable {product_id, requested, available}
  INSERT order + order_items (price/name snapshots)
  INSERT notification for the farmer
COMMIT
```

The guarded `UPDATE` is the concurrency control. Two customers racing for the last basket
cannot both succeed, and no separate lock is needed.

### Favorites, reviews, notifications
```
GET/POST/DELETE /favorites          POST body { target_type, target_id }
GET    /reviews?product_id=|farmer_id=
POST   /reviews                     { order_id, product_id, rating, title, body }
POST   /reviews/:id/reply           farmer
GET    /notifications               ?unread=true
POST   /notifications/:id/read
```

### Admin
```
GET    /admin/metrics               totals: farmers, customers, markets, orders, revenue
GET    /admin/farmers?status=pending
POST   /admin/farmers/:id/approve | /suspend
GET    /admin/customers             PATCH /admin/customers/:id  (is_active)
CRUD   /admin/markets
CRUD   /admin/categories
GET    /admin/reports/summary       ?from=&to=
GET    /admin/reports/revenue-by-market.csv
GET    /admin/reports/top-farmers.csv
DELETE /admin/moderation/products/:id | /reviews/:id
POST   /admin/announcements
```

### Assistant
```
POST   /assistant/ask               { question, lat?, lng? } → { intent, answer, results[], followups[] }
GET    /assistant/faq               popular question chips
```

---

## 7. Assistant Design (rule-based)

No LLM. A deterministic matcher over the app's own data, which is defensible in a demo and
cannot hallucinate a farmer out of existence.

**Pipeline:** normalise the question → match intent by keyword/regex → extract slots
(category, price ceiling, distance, day, market, farmer name) → run the same service
functions the browse pages use → compose a short answer + result cards.

| Intent | Triggers | Answer shape |
|---|---|---|
| `find_product` | "need", "looking for", "buy", a category or product word | "Found 4 baskets of tomatoes under ₦3,000 near you" + cards |
| `market_hours` | "open", "time", "when", "hours" | market name, days, opens–closes |
| `farmer_availability` | farmer/stall name + "available"/"stock" | what they have this week |
| `pickup_info` | "pickup", "where", "collect", "directions" | location + window + directions link |
| `price_check` | "price", "how much", "cost" | price/unit of matches |
| `fallback` | nothing matched | FAQ chips + "try: best markets near me" |

Numeric extraction handles `₦3,000`, `3000 naira`, `3k`, and `under/below/less than`.
Distance defaults to the caller's coordinates when present, otherwise Lagos centre from
config. Every response includes the SQL-derived reason it matched, surfaced in the UI as
"Showing top results based on your location and preferences" — honest, and it reads as
explainable AI.

---

## 8. UI System

### 8.1 Tokens

Derived from the approved mockups and held as Tailwind theme values, not inline hex.

| token | value | use |
|---|---|---|
| `bg/base` | `#07130F` | page background |
| `bg/surface` | `#0D1F1A` | cards, panels |
| `bg/elevated` | `#122A23` | inputs, nested rows |
| `border/subtle` | `#1C3A31` | hairlines |
| `text/primary` | `#E8F3EE` | headings |
| `text/muted` | `#8FA9A0` | secondary |
| `accent` | `#5FE38A` | primary buttons, active nav, in-stock |
| `accent/soft` | `rgba(95,227,138,0.12)` | chip fills, icon wells |
| `warn` | `#F2C14E` | pending, preparing |
| `danger` | `#F26D6D` | sold out, declined, cancel |

Type: **Space Grotesk** for headings and the wordmark, **Inter** for body and numerals,
tabular figures for prices. Radii 12/16/999. Cards use a single hairline border — no double
rings, no drop shadows on dark.

### 8.2 Component inventory (built in phase 1, reused everywhere)

`Button` (primary/ghost/danger, sm/md), `Chip`, `Badge` (status), `Card`, `ProductCard`,
`MarketCard`, `FarmerCard`, `Input`, `Select`, `PriceRange`, `Tabs`, `Avatar` (photo or
neutral person icon — never initials), `QuantityStepper`, `StatusTimeline`, `EmptyState`,
`Skeleton`, `Toast`, `Modal`, `MapCanvas`, `DataTable`, `SidebarNav`, `TopNav`, `Footer`.

### 8.3 Screen map

| # | Mockup screen | Route | Phase |
|---|---|---|---|
| 1 | Home / Landing | `/` | 7 |
| 2 | Market Discovery / Map | `/markets` | 7 |
| 3 | Products Listing | `/products` | 8 |
| 4 | Farmer Profile | `/farmers/:id` | 8 |
| 5 | Product Details | `/products/:id` | 8 |
| 6 | Cart & Checkout | `/cart`, `/checkout` | 10 |
| 7 | Order Tracking | `/orders/:reference` | 11 |
| 8 | Customer Dashboard | `/account` | 11 |
| 9 | Farmer Dashboard | `/farmers/dashboard` | 12 |
| 10 | AI Assistant | `/assistant` | 17 |
| — | Admin | `/admin/*` | 13–14 |
| — | About / Contact | `/about`, `/contact` | 18 |

### 8.4 Responsive contract

Mockups are the desktop target. Each page additionally ships:

- `< 1024px`: sidebar nav → slide-over drawer; 4-col grids → 2-col.
- `< 640px`: 1-col cards; filter sidebar → bottom-sheet `Filters` button; checkout and
  tracking become stacked full-width sections; map takes 45vh above its list.
- Touch targets ≥ 44px; horizontal scroll never appears on the page body.

### 8.5 Accessibility

Semantic landmarks; one `h1` per page; Leaflet markers keyboard-reachable with an
adjacent list-of-results equivalent (the map is never the only way to read a market);
`aria-live` for toasts, cart count, and assistant responses; visible focus rings in
`accent`; contrast ≥ 4.5:1 for body text — `text/muted` on `bg/surface` is the one pair to
check at build time; forms use real `<label>`s with inline error text, not placeholder-only.

---

## 9. Error Handling

### 9.1 API

```json
{ "error": { "code": "stock_unavailable", "message": "Only 3 baskets left for Organic Tomatoes", "details": { "product_id": "…", "available": 3, "requested": 5 } } }
```

| HTTP | code | cause |
|---|---|---|
| 400 | `validation_failed` | zod rejects the body/query |
| 401 | `unauthenticated` | missing/expired JWT |
| 403 | `forbidden`, `account_disabled`, `farmer_not_approved` | role/ownership gate |
| 404 | `not_found` | unknown id, or a row the caller may not see |
| 409 | `stock_unavailable`, `cutoff_passed`, `invalid_transition`, `already_reviewed` | state conflict |
| 429 | `rate_limited` | assistant + auth endpoints |
| 500 | `internal` | unexpected; message logged, never leaked |

Request IDs on every response and log line, generated at the edge middleware.

### 9.2 Client

TanStack Query `onError` → toast with the server `message`. `401` → clear session, redirect
to login with a `returnTo` param. `409 stock_unavailable` → the affected cart line is marked
inline and the cart refetches availability, because the honest state of a market app is that
stock changed while you were browsing. Optimistic updates only for favorites and quantity
steppers, both rolled back on failure. Every list has an empty state and a retry; no screen
renders a blank panel.

### 9.3 Boundaries

Zod schemas are the single definition of a request, shared as types with the client where
practical. Boot fails fast if any required env var is missing or malformed. The order
transaction is the only place with multi-statement writes, and it is wrapped so any throw
rolls back.

---

## 10. Testing

| Layer | Tool | Coverage |
|---|---|---|
| Service logic | Vitest unit | status machine transitions, cutoff math, ISO week helper, kobo formatting, assistant intent matcher, availability rule |
| API | Vitest + Supertest against a local Postgres test DB | auth gates per role, `POST /orders` happy path, **concurrent last-basket race**, cancel restores stock, farmer cannot touch another farmer's product, admin-only routes |
| Schema | `pgTAP` assertions in the migration folder | constraints hold, `CHECK (quantity_available >= 0)` really rejects negatives, seed loads |
| Components | Vitest + Testing Library | QuantityStepper, StatusTimeline, PriceRange, EmptyState, form validation messages |
| End-to-end | Playwright, ~6 flows | register→browse→add to cart→checkout→track; farmer login→publish stock→accept order; admin approves a pending farmer; map search returns markers; assistant answers a price question; cancel before cutoff |
| Static | `tsc --noEmit`, ESLint, Prettier | CI on every push |

The concurrency test is the one to protect: 10 parallel `POST /orders` for 5 baskets of the
same product must yield exactly 5 orders and 0 remaining stock.

Seed data is never used in tests — tests build their own fixtures.

---

## 11. Non-Functional Requirements

- **Performance:** landing under 2s on 3G; route-level code splitting; map tiles lazy;
  product lists paginated at 24; `lat/lng` and `(category, price)` indexes; images served
  from Storage at 2 sizes via `srcset`.
- **Scalability:** stateless Node behind any host; `pool: { max: 10 }`; distance query uses
  a bounding-box prefilter before the exact haversine so it does not scan every market.
- **Security:** service-role key server-only; parameterised SQL only, no string
  interpolation; bcrypt never hand-rolled (Supabase handles hashing); CORS locked to the
  client origin; rate limits on auth and assistant; upload type/size validated
  (jpeg/png/webp, ≤ 5 MB); no secrets in the bundle.
- **Availability:** read-only browse works with the API degraded (cached queries); Supabase
  and Render free tiers documented in the README with their cold-start caveat.
- **Operability:** JSON logs with request IDs; `/healthz` returns DB and auth reachability.

---

## 12. The 20 Phases

Each phase lists its **exit test** — what you can click or run when it is done. Phases are
sequential; nothing downstream assumes an unfinished one.

### Foundation

**1 — Scaffold, design system, and repository**
`git init` with `.gitignore` (env files, `node_modules`, build output) before the first
commit. Workspaces, TS configs, Tailwind tokens, ESLint/Prettier, `.env.example`, shared
components (8.2), static route shells. Every subsequent phase closes with one commit whose
message starts with its phase number (`12: farmer dashboard`), which is also the history
`init-pipeline` reads at the midpoint gate.
*Exit:* `npm run dev` serves the styled landing skeleton with the real nav and footer, and
`git log` shows the phase 1 commit.

**2 — Database schema and seed**
All migrations from section 4, indexes, constraints, RLS enabled, `pgTAP` checks, Lagos seed
(4 markets, 8 approved farmers + 1 pending, 5 categories, ~40 products with stock for the
current ISO week).
*Exit:* SQL applies cleanly in Supabase; `select count(*)` per table matches the seed spec.

**3 — Server core, middleware, and API contract**
Express app, env validation, `pg` pool, Supabase admin client, request ID, JSON error
handler, `requireAuth`, `requireRole`, zod helper, `/healthz`, CORS. The zod schemas are the
single definition of every request, and `openapi.json` is generated from them in this phase
so the contract exists before any UI consumes it.
*Exit:* `GET /healthz` green; an unauthenticated `/api/me` returns `401 unauthenticated`;
`openapi.json` validates and lists the auth + profile routes.

**4 — Authentication vertical slice**
Bootstrap, `/me`, sign-up/login UI with role choice, session context, protected-route
wrapper, logout, farmer `pending` state.
*Exit:* register as customer and as farmer; farmer dashboard shows "awaiting approval";
reloading keeps the session.

### Catalogue

**5 — Markets and farmers API**
Tables, nearby bbox + haversine query, market detail with roster, farmer profile payload,
`/farmers/me` patch + geo pin.
*Exit:* `curl` returns Lagos markets sorted by distance and a farmer with their market list.

**6 — Products, stock, and uploads API**
Product CRUD, category master data, filter/sort/search query builder, weekly stock read/upsert/
reset, sold-out toggle, Storage upload route.
*Exit:* a farmer creates a product with a real photo, sets week stock, marks it sold out, and
the API reflects all four states.

**7 — Public discovery UI: Home and Market Map**
Landing hero, nearby-market rail, market discovery list, Leaflet + OSM map with markers,
popups, Map/Satellite toggle, "open now / this week / nearby" filters, distance labels.
*Exit:* visitor lands, searches a location, sees matching markers, clicks one, opens a market.

**8 — Catalogue pages**
Products listing with the filter sidebar (categories, price range, market, farmer, in-stock),
farmer profile with tabs (about/products/reviews) and this-week harvest, product detail with
gallery, stock badge, quantity stepper, add-to-cart, favourite.
*Exit:* browse → filter → open a product → add to cart as a logged-out visitor.

> ### Midpoint gate — after phase 8, before phase 9
>
> Run `six-stage-pipeline:init-pipeline` once here. It is a brownfield tool: it investigates
> eight domains from **existing** code (module graph, error-handling convention, a real call
> chain, data access, config, tests, build, git conventions) and refuses to invent anything
> where there is no precedent. Before phase 1 there is nothing to observe, so running it
> earlier would only re-ask questions this spec already answers.
>
> Phase 8 is the chosen point because it is the first moment both halves of the codebase have
> a pattern to learn from: phases 3–6 fixed the server layering and error-code convention,
> phases 7–8 fixed component composition, routing, and data-fetching. Freezing at phase 6
> would capture only the backend and leave the entire UI layer un-governed.
>
> It generates `AGENTS.md`, rules `R01–R04`, domain skills for the repeated operations (add a
> table, add an endpoint, add an error code), a scripted L0 build gate, and the environment
> pitfalls surfaced by an actual build run. Those assets then govern phases 9–20 — precisely
> the orders, dashboards, and admin block where a 20-phase build would otherwise drift.
>
> *Exit:* the gate command runs green, `AGENTS.md` documents build commands and known
> environment traps, and phase 9 starts against a project that now describes itself.

### Orders

**9 — Orders API and status machine**
The transactional `POST /orders` from 6.1, cutoff computation, transition validation, cancel/
modify with stock restoration, notifications on transitions.
*Exit:* Supertest proves the concurrent last-basket race and that cancelling restores stock.

**10 — Cart and checkout UI**
Cart drawer/page with steppers and line totals, checkout with pickup location, date and slot
picker constrained to the farmer's window and market days, pay-at-pickup tile, order summary,
place-order with `409` handling.
*Exit:* customer places a real order end to end and sees their reference.

**11 — Customer dashboard and order tracking**
Dashboard shell with sidebar, KPI cards, recent orders, quick actions, order list with
filters, tracking page with `StatusTimeline`, pickup details + mini map, reorder, favourites,
saved addresses, review CTA on completed orders.
*Exit:* customer tracks the order from 10 through status changes and reorders from history.

**12 — Farmer dashboard**
KPI row (this-week revenue, total orders, pending, ready for pickup), today's orders table
with accept/decline/ready actions, weekly inventory bars, stock editor with template reset,
product manager, pickup window and cutoff settings, reviews with reply.
*Exit:* farmer accepts an order, marks it ready, and their KPIs update.

### Platform

**13 — Admin console**
Approve/suspend farmers, activate/deactivate customers, markets CRUD with map pin picker,
category master data, moderation queue for listings and reviews, announcements.
*Exit:* admin approves the pending farmer from phase 4 and their stall appears publicly.

**14 — Reports and analytics**
Platform metrics, orders and revenue over a date range, revenue by market, top farmers,
best-selling products, CSV export, charting on the admin overview.
*Exit:* both CSV downloads open with rows matching the on-screen charts.

**15 — Reviews, ratings, notifications**
Review submission gated to completed orders, aggregate ratings recomputed on write and shown
on cards, notification bell with unread count and mark-read, e-mail via Resend or SMTP on
order placed / accepted / ready, with per-kind user preference.
*Exit:* a completed order yields a review that lifts the farmer's average, and the farmer
gets both an in-app and an e-mail alert when an order is ready.

**16 — Search hardening and empty states**
Full-text search across products/farmers/markets, typo-tolerant matching, global nav search,
saved searches, every empty/error/loading state reviewed against the mockups.
*Exit:* a misspelled product still surfaces the right listing; no screen can render blank.

### Finish

**17 — AI assistant**
Intent matcher, slot extraction, price/distance/day parsing, result cards, popular-question
chips, followups, rate limit, "why this matched" explanation line.
*Exit:* "I need fresh tomatoes near me under ₦3,000" returns in-stock baskets with distances.

**18 — About, Contact, and content**
Team/about page, contact page with static details and an embedded OSM map, footer links,
legal/privacy blurb, AI-tool acknowledgment section required by the SRS.
*Exit:* both pages complete and linked from the footer.

**19 — Responsive, a11y, and performance pass**
All 10 screens at 375/768/1280 captured through the browser-use MCP — those shots become the
visual-regression baseline, committed alongside the code. Keyboard-only walkthrough, contrast
and label fixes, code splitting, image sizes, bundle audit, Lighthouse ≥ 90 on performance
and accessibility. Reviewed with `product-design:access`, `product-design:check`, and the
design-review suite (`accessibility-review`, `responsive-design`,
`component-library-alignment`, `design-debt-review`, `visual-regression-review`).
*Exit:* Lighthouse report and a screen-recording of the checkout on a phone width.

**20 — Deploy, diagrams, and hand-off**
Provision Supabase project, deploy Node to Render/Railway and client to Vercel/Netlify, wire
env vars and redirect URLs, smoke test on production. Generate the SRS-mandated architecture
and flow diagrams with `architecture-visualization` (`system-modeler` reads the real
boundaries, `c4model` and `graphviz` hold them as regenerable source, `flow-visualizer` draws
the order path) instead of hand-drawn boxes that drift from the code. Run
`postman:agent-ready-apis` against the `openapi.json` from phase 3 and fix what it flags.
README with setup + diagrams + AI usage disclosure, judge demo script, seed reset
instructions.
*Exit:* a public URL running the seeded demo, diagrams that regenerate from source, an
agent-readiness score on the API, and a README a stranger can follow to rebuild it.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Supabase free-tier projects pause after inactivity, killing the demo | Keep the local Postgres path working; re-activate before demo day; seed script is idempotent |
| Free Node host cold-starts add ~30s to the first request | Warm-up ping cron; document the caveat in the demo script |
| OSM tile usage policy for a public demo | Standard attribution, lazy tiles, low volume is fine; Google Maps swap is one component behind `MapCanvas` if forced |
| Order concurrency bug oversells stock | Phase 9's race test is a hard gate before any UI ships |
| 20 phases slip under hackathon time pressure | Phases 1–12 are the passing line; 13–16 are the completeness line; 17–20 are polish. Cutting after 12 still demonstrates every SRS role |
| SRS penalises unmodified AI-generated code | Every phase is reviewed and edited by the user; the acknowledgment section names the tools; the assistant is hand-written rule logic, not a wrapper |

---

## 14. Deliverables (SRS 1.9 mapping)

Working web app on a public URL · source repository with this spec and the phase plan ·
SQL migrations and seed · architecture and flow diagrams (from the SRS, updated to this
stack) · README with setup instructions · AI-tool acknowledgment · demo script.

---

## 15. Toolchain

Verified against this machine on 2026-09-24, not assumed.

### 15.1 What serves which phase

| Tool | Phases | Role |
|---|---|---|
| `superpowers:writing-plans` | before 1 | turns this spec into the per-phase plan |
| `ui-ux-pro-max`, `frontend-design` | 1, 7–12 | tokens, component system, anti-template visual direction |
| `open-code-review` (`ocr`) | every phase close | line-level review of that phase's diff |
| `six-stage-pipeline:init-pipeline` | after 8 | freezes conventions into `AGENTS.md`, `R01–R04`, domain skills, build gate |
| `browser-use` MCP | 19 | screenshots at 375/768/1280, regression baseline |
| `design-review` suite | 19 | accessibility, responsive, component alignment, design debt, visual regression |
| `product-design:access`, `:check` | 19 | independent a11y and quality pass |
| `architecture-visualization` | 20 | SRS architecture + flow diagrams as regenerable source |
| `postman:agent-ready-apis` | 20 | scores `openapi.json` across 48 checks |
| `qoder-qmind` MCP | all | SRS + spec retrievable once conversation context compresses |

Deliberately unused: `shopify-plugins`, `modeling-glb`, `tarot-pixel` (needs the Tarot Pixel
MCP, not connected, and node-level design imports — the mockups are flat PNG sheets).
`product-management` and the rest of `product-design` are redundant now that the SRS is read
and this spec exists.

### 15.2 Review cadence

Each phase closes with a commit (`12: farmer dashboard`) and an `ocr` review of that diff.
Findings are triaged before the next phase starts; nothing carries forward as an unaddressed
comment. This is what makes 20 phases survivable — the review boundary is the phase, not the
project.

### 15.3 Environment facts and gaps

| Item | State | Consequence |
|---|---|---|
| git 2.54.0 | present | per-phase commits work |
| node v24.15.0 / npm 11.14.1 | present | Vite, React, Express fine |
| Docker | present | local Postgres for the phase 9 race test |
| `psql` | **absent** | no Postgres CLI — the test database runs in Docker, and migrations are applied through the Supabase dashboard as decided |
| `ocr` v1.12.9 | installed, provider `gemini` + model set | **one step from working** — needs the AI Studio key (15.4) |
| graphviz `dot` | **absent** | C4/DOT authored as source; rendering goes through the Qoder viewer, or install Graphviz before phase 20 if PNG output is wanted |

### 15.4 Outstanding setup

`ocr` reviews run on **Google AI Studio (Gemini)**, not Anthropic. Provider and model are
already configured on this machine:

```
ocr config set provider gemini          # done — generativelanguage.googleapis.com/v1beta/openai
ocr config set model gemini-2.5-flash   # done; switch with `ocr config model`
```

One step remains, and it must be run by the user because it involves the key:

```
ocr config set providers.gemini.api_key "PASTE_YOUR_AI_STUDIO_KEY"
ocr llm test
```

**Generate the key at aistudio.google.com/apikey and run that command in your own terminal —
do not paste it into chat**, since a key in the conversation transcript is a key in a log
file. `ocr llm test` must pass before the phase 1 review; until then reviews fall back to
`superpowers:requesting-code-review`.
