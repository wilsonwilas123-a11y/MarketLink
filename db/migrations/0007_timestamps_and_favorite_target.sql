-- Row-level plumbing only. Aggregation and order-state rules stay in the Node service
-- layer per the architecture decision; these triggers exist because the database is the
-- only place that can guarantee them on every write path.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- profiles, markets, farmers, products, weekly_stock and orders all carry updated_at.
do $trg$
declare
  t text;
begin
  foreach t in array array['profiles', 'markets', 'farmers', 'products', 'weekly_stock', 'orders']
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format(
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at()',
      t
    );
  end loop;
end
$trg$;

-- `favorites.target_id` is polymorphic, so no foreign key can cover it and a dangling
-- target would render a broken card. This asserts the uuid exists in the table the
-- row's own target_type points at — an existence invariant, not business logic.
create or replace function assert_favorite_target_exists()
returns trigger
language plpgsql
as $$
declare
  found boolean;
begin
  if new.target_type = 'farmer' then
    select exists (select 1 from farmers where id = new.target_id) into found;
  else
    select exists (select 1 from products where id = new.target_id) into found;
  end if;

  if not found then
    raise exception 'favorite target % does not exist for target_type %',
      new.target_id, new.target_type
      using errcode = '23503';
  end if;

  return new;
end
$$;

create trigger favorites_target_exists
before insert or update of target_id, target_type on favorites
for each row execute function assert_favorite_target_exists();
