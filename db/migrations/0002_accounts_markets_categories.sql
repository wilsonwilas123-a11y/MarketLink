-- Accounts, markets and the category master list.

create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('customer', 'farmer', 'admin')),
  full_name   text not null check (length(btrim(full_name)) > 0),
  phone       text not null check (length(btrim(phone)) > 0),
  address     text,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table markets (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) > 0),
  address        text not null,
  city           text not null,
  state          text not null,
  lat            numeric(9, 6) not null check (lat between -90 and 90),
  lng            numeric(9, 6) not null check (lng between -180 and 180),
  operating_days text[] not null default '{}',
  opens_at       time not null,
  closes_at      time not null,
  image_url      text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- An overnight market would need a wrap-around rule; none in the seed has one, so
  -- rejecting it here is cheaper than reasoning about it everywhere it is read.
  constraint markets_open_before_close check (opens_at < closes_at)
);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) > 0),
  slug       text not null unique check (slug ~ '^[a-z][a-z0-9-]*$'),
  icon_key   text not null,
  sort_order int not null default 0
);

-- Listing searches filter on city and read active markets only; the admin table sorts
-- by name, so give both a home rather than seq-scanning as the rows grow.
create index markets_city_idx on markets (city);
create index markets_active_idx on markets (is_active);
create index categories_sort_idx on categories (sort_order);
