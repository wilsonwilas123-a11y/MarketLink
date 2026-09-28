-- In local development the API can use a plain PostgreSQL database while Supabase Auth
-- remains hosted. A verified Supabase user will not have a row in the local `auth.users`
-- stub, so a foreign key from profiles to that stub rejects every real signup. Keep the
-- FK on Supabase Postgres (where Auth and MarketLink data share the same auth.users table),
-- but remove it from the local stub. The API still verifies every bearer token with
-- Supabase before it reads or creates a profile.
do $migration$
begin
  if to_regclass('auth.users') is not null
     and not exists (
       select 1
         from information_schema.columns
        where table_schema = 'auth'
          and table_name = 'users'
          and column_name = 'instance_id'
     ) then
    alter table public.profiles drop constraint if exists profiles_id_fkey;
  end if;
end
$migration$;
