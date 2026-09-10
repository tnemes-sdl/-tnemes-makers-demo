import { DIFFICULTIES } from './countries';
import type { Difficulty } from './countries';

/**
 * A finished World Country Finder game's personal-best entry. Its own shape,
 * separate from the sibling game's `ScoreEntry`: this game's score is a flat
 * correct-out-of-10 count, not a point total, so the two aren't comparable.
 */
export type CountryScoreEntry = {
  correct: number;
  /** ISO timestamp of when the game finished. */
  playedAt: string;
};

export type CountryScoresByDifficulty = Record<Difficulty, CountryScoreEntry[]>;

/** How many personal bests are kept per difficulty tier. */
export const MAX_COUNTRY_SCORES = 5;

/**
 * One storage key for all three difficulty tiers, so a single "Clear bests"
 * control can wipe them together without per-tier bookkeeping.
 */
export const COUNTRY_STORAGE_KEY = 'world-country-finder:best-scores';

const emptyTable = (): CountryScoresByDifficulty => ({ easy: [], medium: [], hard: [] });

const isEntry = (value: unknown): value is CountryScoreEntry =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as CountryScoreEntry).correct === 'number' &&
  Number.isFinite((value as CountryScoreEntry).correct);

/**
 * Reads the saved table. Anything unreadable — a missing key, a value that is
 * not JSON, a shape that isn't per-difficulty lists — is treated as "no games
 * yet" rather than thrown, mirroring `scores.ts`'s never-throw contract:
 * `main.ts` can read a best score during module evaluation, and an exception
 * here would abort the module and leave a blank page.
 */
export function loadCountryScores(storage: Storage = window.localStorage): CountryScoresByDifficulty {
  try {
    const raw = storage.getItem(COUNTRY_STORAGE_KEY);
    if (raw === null) return emptyTable();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyTable();
    const table = emptyTable();
    for (const difficulty of DIFFICULTIES) {
      const list = (parsed as Record<string, unknown>)[difficulty];
      table[difficulty] = Array.isArray(list) ? list.filter(isEntry) : [];
    }
    return table;
  } catch {
    return emptyTable();
  }
}

/**
 * Adds a finished game to its difficulty's table and writes the whole table
 * back, returning the new per-difficulty list. Kept sorted so the best run is
 * always first — descending, since the slice below keeps the *head* of the
 * list.
 */
export function recordCountryScore(
  difficulty: Difficulty,
  entry: CountryScoreEntry,
  storage: Storage = window.localStorage,
): CountryScoreEntry[] {
  const table = loadCountryScores(storage);
  const next = [...table[difficulty], entry]
    .sort((a, b) => b.correct - a.correct)
    .slice(0, MAX_COUNTRY_SCORES);
  table[difficulty] = next;

  // A failed write costs the player their saved history, not their game: the
  // caller opens the summary dialog off the back of this, so throwing here
  // would strand a finished game with no way out.
  try {
    storage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify(table));
  } catch {
    /* nothing saved; the table returned below still reflects this game */
  }
  return next;
}

/** The best run so far for a difficulty, or null before its first finished game. */
export function bestCountryScore(
  difficulty: Difficulty,
  storage: Storage = window.localStorage,
): CountryScoreEntry | null {
  return loadCountryScores(storage)[difficulty][0] ?? null;
}

/** Clears all three per-difficulty tables — there is no per-tier clear. */
export function clearCountryScores(storage: Storage = window.localStorage): void {
  try {
    storage.removeItem(COUNTRY_STORAGE_KEY);
  } catch {
    /* nothing to clear if storage is unavailable */
  }
}
