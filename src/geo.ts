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

/** What a bullseye is worth, before any speed bonus. */
export const MAX_DISTANCE_SCORE = 1000;

/**
 * Exponential decay: a bullseye is ~1000, ~779 at 500 km, ~607 at 1000 km,
 * ~368 at 2000 km, ~8 at 10000 km. Tuned for the world map — the right
 * continent still earns real points, while precision keeps paying off.
 */
export function scoreForDistance(km: number): number {
  return Math.round(MAX_DISTANCE_SCORE * Math.exp(-Math.max(0, km) / SCORE_DECAY_KM));
}

/** Human-readable distance: metres under 1 km, whole kilometres above. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

/** Share of a round's points that can be earned back by answering fast. */
export const SPEED_BONUS_SHARE = 0.2;

/**
 * Bonus points for a quick answer: a guess placed the instant the city appears is
 * worth `SPEED_BONUS_SHARE` more than the same guess placed on the buzzer, scaling
 * linearly with the time left on the clock.
 *
 * `roundSeconds` is the clock the bonus is measured against — it must be the
 * round length actually in play (`game.secondsPerRound`), not a constant, or a
 * game configured with `?seconds=` pays a different share than the documented one.
 * The ratio is clamped to 1 so a `secondsLeft` from a longer clock cannot inflate
 * the bonus past its share.
 */
export function speedBonus(score: number, secondsLeft: number, roundSeconds: number): number {
  if (roundSeconds <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, secondsLeft) / roundSeconds);
  return Math.round(score * SPEED_BONUS_SHARE * ratio);
}
