-- Ensures `auth.users` exists, then adds the SQL helpers the rest of the schema relies on.
--
-- On Supabase `auth.users` is real and the guard below is skipped, so this file never
-- touches the managed auth schema. On a plain Postgres instance (local checks, CI) it
-- creates a stand-in so `profiles` has something to point at.

do $auth$
begin
  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    create table auth.users (
      id                 uuid primary key default gen_random_uuid(),
      email              text unique not null,
      phone              text,
      encrypted_password text not null default '',
      email_confirmed_at timestamptz default now(),
      created_at         timestamptz not null default now()
    );
    raise notice 'auth.users is absent; created a local stand-in for testing only';
  end if;
end
$auth$;

-- An ISO week label such as '2026-W39'. `IYYY-IW` is what makes it ISO rather than
-- calendar-based, so a week that straddles New Year is labelled by its Thursday.
create or replace function iso_week(on_date date default current_date)
returns text
language sql
immutable
as $$
  select to_char(on_date, 'IYYY-"W"IW');
$$;

-- Order references read as ML-2048 in the UI. The sequence keeps them short and
-- non-guessable-by-enumeration in aggregate, unlike a row count exposed directly.
create sequence if not exists order_reference_seq start 2048;

create or replace function next_order_reference()
returns text
language sql
volatile
as $$
  select 'ML-' || nextval('order_reference_seq')::text;
$$;
