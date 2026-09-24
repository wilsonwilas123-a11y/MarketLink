-- Orders and their line items. One farmer per order; a mixed cart is split before insert
-- (spec 4.14), so nothing here has to model a multi-stall pickup.

create table orders (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique default next_order_reference(),
  customer_id        uuid not null references profiles (id) on delete restrict,
  farmer_id          uuid not null references farmers (id) on delete restrict,
  market_id          uuid not null references markets (id) on delete restrict,
  status             text not null default 'placed'
                     check (status in ('placed', 'accepted', 'preparing',
                                       'ready_for_pickup', 'completed', 'cancelled')),
  subtotal_kobo      bigint not null check (subtotal_kobo >= 0),
  delivery_fee_kobo  bigint not null default 0 check (delivery_fee_kobo = 0),
  pickup_date        date not null,
  pickup_slot_start  time not null,
  pickup_slot_end    time not null,
  cutoff_at          timestamptz not null,
  placed_at          timestamptz not null default now(),
  accepted_at        timestamptz,
  ready_at           timestamptz,
  completed_at       timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint orders_slot_ordered check (pickup_slot_start < pickup_slot_end)
);

create index orders_customer_idx on orders (customer_id, placed_at desc);
create index orders_farmer_idx on orders (farmer_id, status);
create index orders_reference_idx on orders (reference);

create table order_items (
  order_id             uuid not null references orders (id) on delete cascade,
  product_id           uuid not null references products (id) on delete restrict,
  -- Snapshots: a farmer repricing or renaming a product must not rewrite history,
  -- and a receipt that changes under the customer is worse than no receipt.
  product_name_snapshot  text not null,
  unit_snapshot          text not null,
  price_kobo_snapshot    bigint not null check (price_kobo_snapshot >= 0),
  quantity               int not null check (quantity > 0),

  primary key (order_id, product_id)
);

create index order_items_product_idx on order_items (product_id);
