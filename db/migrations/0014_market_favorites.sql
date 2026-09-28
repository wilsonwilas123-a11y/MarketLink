-- Customers can keep frequently used pickup markets alongside saved farmers and produce.
alter table favorites drop constraint favorites_target_type_check;
alter table favorites add constraint favorites_target_type_check
  check (target_type in ('farmer', 'product', 'market'));

create or replace function assert_favorite_target_exists()
returns trigger
language plpgsql
as $$
declare
  found boolean;
begin
  if new.target_type = 'farmer' then
    select exists (select 1 from farmers where id = new.target_id) into found;
  elsif new.target_type = 'product' then
    select exists (select 1 from products where id = new.target_id) into found;
  else
    select exists (select 1 from markets where id = new.target_id) into found;
  end if;

  if not found then
    raise exception 'favorite target % does not exist for target_type %',
      new.target_id, new.target_type using errcode = '23503';
  end if;
  return new;
end
$$;
