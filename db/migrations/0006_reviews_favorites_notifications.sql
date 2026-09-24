-- Reviews, favourites and in-app notifications.

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  product_id   uuid not null references products (id) on delete cascade,
  farmer_id    uuid not null references farmers (id) on delete cascade,
  customer_id  uuid not null references profiles (id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  title        text,
  body         text,
  farmer_reply text,
  replied_at   timestamptz,
  status       text not null default 'visible' check (status in ('visible', 'removed')),
  created_at   timestamptz not null default now(),

  -- One review per product per order, enforced here so a double-click cannot post twice
  -- even if the UI check is bypassed.
  constraint reviews_once_per_order_product unique (order_id, product_id)
);

create index reviews_product_idx on reviews (product_id, created_at desc);
create index reviews_farmer_idx on reviews (farmer_id, created_at desc);

-- Favourites point at either a farmer or a product. The two-sided FKs below mean a
-- target has to exist in one of the two tables; the trigger in 0007 makes that
-- exclusive-or explicit, since a row cannot tell which table its uuid came from.
create table favorites (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles (id) on delete cascade,
  target_type text not null check (target_type in ('farmer', 'product')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),

  constraint favorites_once_per_target unique (profile_id, target_type, target_id)
);

create index favorites_profile_idx on favorites (profile_id, target_type);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  kind       text not null check (kind in ('order_placed', 'order_accepted', 'order_ready',
                                           'order_cancelled', 'stock_low', 'announcement')),
  title      text not null,
  body       text not null,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx on notifications (profile_id, read_at, created_at desc);
