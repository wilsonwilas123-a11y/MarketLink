-- Vendor stalls and which market each one trades at.

create table farmers (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null unique references profiles (id) on delete cascade,
  stall_name            text not null check (length(btrim(stall_name)) > 0),
  contact_person        text,
  description           text,
  logo_url              text,
  cover_url             text,
  lat                   numeric(9, 6) check (lat between -90 and 90),
  lng                   numeric(9, 6) check (lng between -180 and 180),
  operating_days        text[] not null default '{}',
  pickup_window_start   time,
  pickup_window_end     time,
  order_cutoff_minutes  int not null default 120 check (order_cutoff_minutes >= 0),
  status                text not null default 'pending'
                        check (status in ('pending', 'approved', 'suspended')),
  rating_avg            numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  rating_count          int not null default 0 check (rating_count >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint farmers_pickup_window_ordered
    check (pickup_window_start is null or pickup_window_end is null
           or pickup_window_start < pickup_window_end)
);

-- `/farmers/me` resolves a caller to a single stall, which is what the unique
-- profile_id above guarantees; the public roster only ever reads approved farmers.
create index farmers_status_idx on farmers (status);
create index farmers_location_idx on farmers (lat, lng);

create table market_farmers (
  market_id uuid not null references markets (id) on delete cascade,
  farmer_id uuid not null references farmers (id) on delete cascade,
  stall_ref text,
  days      text[] not null default '{}',
  primary key (market_id, farmer_id)
);

create index market_farmers_farmer_idx on market_farmers (farmer_id);
