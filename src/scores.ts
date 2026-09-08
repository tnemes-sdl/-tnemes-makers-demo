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

const STORAGE_KEY = 'wherein-the-world:best-scores';

/** Reads the saved table, oldest format tolerated: a missing key means no games yet. */
export function loadScores(storage: Storage = window.localStorage): ScoreEntry[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  return JSON.parse(raw) as ScoreEntry[];
}

/**
 * Adds a finished game to the table and writes it back, returning the new table.
 * Kept sorted so the best run is always first.
 */
export function recordScore(
  entry: ScoreEntry,
  storage: Storage = window.localStorage,
): ScoreEntry[] {
  const next = [...loadScores(storage), entry]
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SCORES);

  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** The single best run so far, or null before the first finished game. */
export function bestScore(storage: Storage = window.localStorage): ScoreEntry | null {
  return loadScores(storage)[0] ?? null;
}

/** Clears the table — used by the "reset bests" control in the summary. */
export function clearScores(storage: Storage = window.localStorage): void {
  storage.removeItem(STORAGE_KEY);
}
