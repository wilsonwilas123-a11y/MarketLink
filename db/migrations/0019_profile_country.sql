-- Keep each account's home country with the shared profile, so buyers can return to a
-- country-aware catalogue and sellers can be routed to the matching market tools.
alter table profiles add column country text not null default 'Nigeria';

alter table profiles add constraint profiles_country_named
  check (length(btrim(country)) > 0);

create index profiles_country_idx on profiles (country);
