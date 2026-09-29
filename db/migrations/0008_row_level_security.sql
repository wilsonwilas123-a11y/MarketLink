-- Row-level security as defence in depth.
--
-- Every legitimate query arrives over Node's service-role connection, which holds
-- BYPASSRLS. These settings exist so that a leaked anon key cannot read the catalogue
-- or another customer's orders straight through PostgREST, even though the API is the
-- only intended door.
--
-- Only applied when the connected user can bypass RLS (Supabase, or a superuser in
-- local/CI). On hosts like Render the app user cannot bypass RLS, and a deny-all
-- policy would lock the app out of its own tables, so the migration is skipped there.

do $rls$
declare
  t record;
  can_bypass boolean;
  has_anon boolean;
  has_authenticated boolean;
  has_service_role boolean;
begin
  select coalesce(rolsuper or rolbypassrls, false)
    into can_bypass
    from pg_roles
   where rolname = current_user;

  if not can_bypass then
    raise notice 'Skipping RLS migration: % cannot bypass RLS (no PostgREST on this host)', current_user;
    return;
  end if;

  -- Supabase ships these roles; a bare Postgres does not. Creating them locally costs
  -- nothing, is skipped on Supabase, and lets the pgTAP suite prove the deny actually
  -- bites instead of only checking that a flag is set.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;

  select exists (select 1 from pg_roles where rolname = 'anon') into has_anon;
  select exists (select 1 from pg_roles where rolname = 'authenticated') into has_authenticated;
  select exists (select 1 from pg_roles where rolname = 'service_role') into has_service_role;

  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname
  loop
    execute format('alter table %I enable row level security', t.relname);

    -- Owners bypass RLS silently; forcing it closes that gap for the table owner too.
    execute format('alter table %I force row level security', t.relname);

    -- Belt and braces: an explicit deny is easier to spot in a review than the absence
    -- of a policy, and it survives someone later adding a permissive default.
    execute format(
      'drop policy if exists "deny non-service" on %I', t.relname);
    execute format(
      'create policy "deny non-service" on %I for all to public using (false) with check (false)',
      t.relname
    );

    if has_anon then
      execute format('revoke all on %I from anon', t.relname);
    end if;

    if has_authenticated then
      execute format('revoke all on %I from authenticated', t.relname);
    end if;

    -- service_role normally carries BYPASSRLS, but do not assume it: on a self-hosted
    -- or future-tier setup it may not, and every query in the app would then fail
    -- against a policy that reads as 'deny'.
    if has_service_role then
      execute format('grant all on %I to service_role', t.relname);
    end if;
  end loop;

  if has_service_role then
    execute 'grant usage on schema public to service_role';
    execute 'grant usage on all sequences in schema public to service_role';
  end if;
end
$rls$;