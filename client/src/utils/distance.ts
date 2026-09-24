/**
 * Distance as a map label and a list row say it.
 *
 * A pitch across town reads better in metres than as `0.4 km`, and one decimal is the most a
 * haversine between two coordinates earns.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
