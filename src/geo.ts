export type LatLon = { lat: number; lon: number };

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance at which a guess is worth ~1/e of a bullseye, in kilometres. */
const SCORE_DECAY_KM = 2000;

/**
 * Exponential decay: a bullseye is ~1000, ~779 at 500 km, ~607 at 1000 km,
 * ~368 at 2000 km, ~8 at 10000 km. Tuned for the world map — the right
 * continent still earns real points, while precision keeps paying off.
 */
export function scoreForDistance(km: number): number {
  return Math.round(1000 * Math.exp(-Math.max(0, km) / SCORE_DECAY_KM));
}

/** Human-readable distance: metres under 1 km, whole kilometres above. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
