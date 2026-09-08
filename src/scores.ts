/**
 * Personal bests, kept in `localStorage` so a player's run survives a reload.
 * Storage is injected so tests can pass a stub instead of touching the browser.
 */
export type ScoreEntry = {
  /** Final total for the game. */
  score: number;
  /** Percentage of a perfect game, already rounded. */
  percent: number;
  /** ISO timestamp of when the game finished. */
  playedAt: string;
};

/** How many personal bests are kept. Older, lower runs fall off the end. */
export const MAX_SCORES = 5;

/** Exported so tests can seed a raw value under the real key. */
export const STORAGE_KEY = 'wherein-the-world:best-scores';

const isEntry = (value: unknown): value is ScoreEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ScoreEntry).score === 'number' &&
  Number.isFinite((value as ScoreEntry).score);

/**
 * Reads the saved table. Anything unreadable — a missing key, a value that is
 * not JSON, a shape that is not a list of entries — is treated as "no games
 * yet" rather than thrown.
 *
 * This must not throw. `main.ts` reads the best score during module evaluation,
 * so an exception here would abort the module and leave the player a blank page,
 * with the Clear bests control unreachable inside a dialog that never renders.
 * Storage access itself can also throw when site data is blocked (Safari private
 * browsing), which is why the `getItem` call is inside the guard too.
 */
export function loadScores(storage: Storage = window.localStorage): ScoreEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

/**
 * Adds a finished game to the table and writes it back, returning the new table.
 * Kept sorted so the best run is always first.
 */
export function recordScore(
  entry: ScoreEntry,
  storage: Storage = window.localStorage,
): ScoreEntry[] {
  // Descending: the slice below keeps the *head* of this list, so sorting the
  // other way round would retain the five worst runs and discard the best.
  const next = [...loadScores(storage), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORES);

  // A failed write costs the player their saved history, not their game: the
  // caller opens the summary dialog off the back of this, so throwing here
  // would strand a finished game with no way out. Blocked site data and a full
  // quota both surface as an exception from `setItem`.
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* nothing saved; the table returned below still reflects this game */
  }
  return next;
}

/** The single best run so far, or null before the first finished game. */
export function bestScore(storage: Storage = window.localStorage): ScoreEntry | null {
  return loadScores(storage)[0] ?? null;
}

/** Clears the table — used by the "reset bests" control in the summary. */
export function clearScores(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}
