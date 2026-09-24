-- Product listings and their per-week availability.

create table products (
  id            uuid primary key default gen_random_uuid(),
  farmer_id     uuid not null references farmers (id) on delete cascade,
  category_id   uuid not null references categories (id) on delete restrict,
  name          text not null check (length(btrim(name)) > 0),
  description   text,
  unit          text not null check (unit in ('basket', 'bunch', 'pack', 'crate', 'l', 'kg')),
  price_kobo    bigint not null check (price_kobo > 0),
  image_urls    text[] not null default '{}',
  template_qty  int not null default 0 check (template_qty >= 0),
  is_organic    boolean not null default false,
  is_active     boolean not null default true,
  rating_avg    numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  rating_count  int not null default 0 check (rating_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index products_farmer_idx on products (farmer_id);
create index products_category_price_idx on products (category_id, price_kobo);
create index products_active_idx on products (is_active);

-- One row per product per ISO week. The week column is deliberately free-form text
-- matching iso_week()'s shape rather than a date, so '2026-W39' can be looked up
-- directly by the same string the API computes.
create table weekly_stock (
  product_id         uuid not null references products (id) on delete cascade,
  week               text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  quantity_available int not null check (quantity_available >= 0),
  is_sold_out        boolean not null default false,
  updated_at         timestamptz not null default now(),

  primary key (product_id, week)
);

-- The stock reset reads every one of a farmer's products for one week.
create index weekly_stock_product_week_idx on weekly_stock (product_id, week desc);
