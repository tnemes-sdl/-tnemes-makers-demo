import { beforeEach, describe, expect, it } from 'vitest';
import {
  COUNTRY_STORAGE_KEY,
  MAX_COUNTRY_SCORES,
  bestCountryScore,
  clearCountryScores,
  loadCountryScores,
  recordCountryScore,
} from './countryScores';
import type { CountryScoreEntry } from './countryScores';

/** Minimal in-memory Storage stub — enough for the calls countryScores.ts makes. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

const entry = (correct: number): CountryScoreEntry => ({
  correct,
  playedAt: '2026-01-01T00:00:00.000Z',
});

describe('countryScores', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('starts empty for every difficulty', () => {
    const table = loadCountryScores(storage);
    expect(table.easy).toEqual([]);
    expect(table.medium).toEqual([]);
    expect(table.hard).toEqual([]);
    expect(bestCountryScore('medium', storage)).toBeNull();
  });

  it('records a finished game under its own difficulty', () => {
    recordCountryScore('hard', entry(6), storage);
    expect(loadCountryScores(storage).hard).toHaveLength(1);
    expect(loadCountryScores(storage).hard[0]?.correct).toBe(6);
    expect(loadCountryScores(storage).easy).toEqual([]);
  });

  it('keeps difficulty tiers independent', () => {
    recordCountryScore('easy', entry(9), storage);
    recordCountryScore('medium', entry(4), storage);
    const table = loadCountryScores(storage);
    expect(table.easy.map((e) => e.correct)).toEqual([9]);
    expect(table.medium.map((e) => e.correct)).toEqual([4]);
    expect(table.hard).toEqual([]);
  });

  it(`keeps at most ${MAX_COUNTRY_SCORES} entries per tier`, () => {
    for (const correct of [1, 2, 3, 4, 5, 6, 7]) {
      recordCountryScore('medium', entry(correct), storage);
    }
    expect(loadCountryScores(storage).medium).toHaveLength(MAX_COUNTRY_SCORES);
  });

  // Asserting the length alone passed while the sort ran the wrong way and the
  // table kept the five *worst* runs, so assert which scores survive.
  it('keeps the best runs and drops the rest, whatever order they arrive in', () => {
    for (const correct of [3, 9, 4, 8, 2, 7, 5]) {
      recordCountryScore('medium', entry(correct), storage);
    }
    expect(loadCountryScores(storage).medium.map((e) => e.correct)).toEqual([9, 8, 7, 5, 4]);
  });

  it('reports the highest correct-count as the best, not the lowest', () => {
    for (const correct of [4, 9, 1]) {
      recordCountryScore('easy', entry(correct), storage);
    }
    expect(bestCountryScore('easy', storage)?.correct).toBe(9);
  });

  it('clears every tier together — there is no per-tier clear', () => {
    recordCountryScore('easy', entry(9), storage);
    recordCountryScore('medium', entry(7), storage);
    recordCountryScore('hard', entry(5), storage);
    clearCountryScores(storage);
    const table = loadCountryScores(storage);
    expect(table.easy).toEqual([]);
    expect(table.medium).toEqual([]);
    expect(table.hard).toEqual([]);
  });
});

/**
 * `main.ts` may read a best score during module evaluation, so none of these
 * may throw — mirroring the sibling game's `scores.ts` contract.
 */
describe('unreadable storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('treats a value that is not JSON as no games yet', () => {
    storage.setItem(COUNTRY_STORAGE_KEY, 'not json');
    expect(loadCountryScores(storage).medium).toEqual([]);
    expect(bestCountryScore('medium', storage)).toBeNull();
  });

  it('ignores JSON that is not an object', () => {
    storage.setItem(COUNTRY_STORAGE_KEY, '[1,2,3]');
    expect(loadCountryScores(storage)).toEqual({ easy: [], medium: [], hard: [] });
  });

  it('drops entries that are not scores', () => {
    storage.setItem(
      COUNTRY_STORAGE_KEY,
      JSON.stringify({ easy: [entry(9), null, 'nope', { playedAt: 'x' }] }),
    );
    expect(loadCountryScores(storage).easy.map((e) => e.correct)).toEqual([9]);
  });

  it('recovers by overwriting the bad value on the next game', () => {
    storage.setItem(COUNTRY_STORAGE_KEY, 'not json');
    expect(recordCountryScore('medium', entry(4), storage).map((e) => e.correct)).toEqual([4]);
    expect(loadCountryScores(storage).medium.map((e) => e.correct)).toEqual([4]);
  });

  it('survives storage that throws on every call', () => {
    const hostile: Storage = {
      length: 0,
      clear: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
      key: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(loadCountryScores(hostile).medium).toEqual([]);
    expect(bestCountryScore('medium', hostile)).toBeNull();
    expect(recordCountryScore('medium', entry(4), hostile).map((e) => e.correct)).toEqual([4]);
    expect(() => clearCountryScores(hostile)).not.toThrow();
  });
});
