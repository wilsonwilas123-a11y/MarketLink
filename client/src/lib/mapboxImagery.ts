const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();

/** A satellite crop centered on the exact market/place coordinates, not a street photo. */
export function mapboxSatellitePreview(lng: number, lat: number): string | null {
  if (!accessToken) return null;
  const center = `${lng},${lat},16,0`;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${center}/448x288?access_token=${encodeURIComponent(accessToken)}`;
}
