/**
 * The distance and opening-hours SQL the discovery queries are built from, and the one piece
 * of arithmetic that is not SQL.
 *
 * Kept here rather than inlined per query because the same two expressions answer "how far"
 * and "is it trading" from both `/markets` and `/markets/nearby`, and a market that reads as
 * open on the list but shut on the map is a bug nobody can explain.
 */

/** Mean Earth radius in km. Close enough for a market finder; not for a flight plan. */
const EARTH_RADIUS_KM = 6371;

/**
 * Lagos wall-clock now, as a `timestamp` without a zone.
 *
 * The zone is named rather than left to the server because a deployment in London would
 * otherwise report every Lagos market as shut during the eight hours that matter most, and
 * would do so identically on every screen, which makes it look like correct data.
 */
export const LAGOS_NOW = "(now() at time zone 'Africa/Lagos')";

/** `tue` for Tuesday, and so on, without depending on the cluster's lc_time locale. */
export const LAGOS_DAY = `(array['mon','tue','wed','thu','fri','sat','sun'])`
  + `[extract(isodow from ${LAGOS_NOW})::int]`;

/** Whether a market's own row says it is trading at this moment. Takes an alias prefix. */
export function isOpenNow(alias: string): string {
  return `(
    ${alias}.operating_days @> array[${LAGOS_DAY}]::text[]
    and ${LAGOS_NOW}::time between ${alias}.opens_at and ${alias}.closes_at
  )`;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * The square that contains every point within `radiusKm` of a spot.
 *
 * This is the prefilter spec 10 asks for: it is a two-sided range on each axis, which the
 * `(lat, lng)` index can serve, so the exact haversine below runs against the handful of
 * markets in the box rather than against the whole table. It over-selects — the corners of
 * the square are outside the circle — which is why `distance_km <= radius_km` still has to
 * be applied afterwards.
 *
 * Longitude degrees shrink toward the poles, so the east-west half-width widens by 1/cos(lat).
 * `NearbyQuerySchema` keeps lat strictly inside ±90, which is what stops that dividing by 0.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number): BoundingBox {
  const latSpan = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngSpan = Math.min(180, latSpan / cosLat);

  return {
    minLat: lat - latSpan,
    maxLat: lat + latSpan,
    minLng: lng - lngSpan,
    maxLng: lng + lngSpan,
  };
}

/**
 * Great-circle distance from a fixed point to a `markets` row, in km.
 *
 * `$1` and `$2` are the origin's lat and lng: positionally fixed, because this fragment goes
 * into the `select` list while the bbox bounds follow it in the `where`.
 */
export const HAVERSINE_KM = `
  2 * ${EARTH_RADIUS_KM} * asin(sqrt(
    power(sin(radians(($1 - lat::float8) / 2)), 2)
    + cos(radians($1)) * cos(radians(lat::float8))
      * power(sin(radians(($2 - lng::float8) / 2)), 2)
  ))
`;
