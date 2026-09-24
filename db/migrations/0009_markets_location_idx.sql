-- The distance query bounds first and measures second (spec 10), so the bounding box needs
-- an index to bound against. `markets` had one on `city` only, which is the list filter, not
-- the map one. Same shape as `farmers_location_idx` from 0003, for the same reason.
create index markets_location_idx on markets (lat, lng);
