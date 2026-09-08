import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_SCORES,
  STORAGE_KEY,
  bestScore,
  clearScores,
  loadScores,
  recordScore,
} from './scores';
import type { ScoreEntry } from './scores';

/** Minimal in-memory Storage stub — enough for the four calls scores.ts makes. */
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

const entry = (score: number): ScoreEntry => ({
  score,
  percent: Math.round(score / 100),
  playedAt: '2026-01-01T00:00:00.000Z',
});

describe('scores', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('starts empty', () => {
    expect(loadScores(storage)).toEqual([]);
    expect(bestScore(storage)).toBeNull();
  });

  it('records a finished game', () => {
    recordScore(entry(4200), storage);
    const saved = loadScores(storage);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.score).toBe(4200);
  });

  it('round-trips through storage rather than an in-memory cache', () => {
    recordScore(entry(1000), storage);
    expect(loadScores(storage)[0]?.playedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it(`keeps at most ${MAX_SCORES} entries`, () => {
    for (const score of [100, 200, 300, 400, 500, 600, 700]) {
      recordScore(entry(score), storage);
    }
    expect(loadScores(storage)).toHaveLength(MAX_SCORES);
  });

  // Asserting the length alone passed while the sort ran the wrong way and the
  // table kept the five *worst* runs, so assert which scores survive.
  it('keeps the best runs and drops the rest, whatever order they arrive in', () => {
    for (const score of [100, 9000, 200, 8000, 300, 7000, 400]) {
      recordScore(entry(score), storage);
    }
    expect(loadScores(storage).map((e) => e.score)).toEqual([9000, 8000, 7000, 400, 300]);
  });

  it('reports the highest score as the best, not the lowest', () => {
    for (const score of [4200, 9000, 1000]) {
      recordScore(entry(score), storage);
    }
    expect(bestScore(storage)?.score).toBe(9000);
  });

  it('sorts an entry into place rather than appending it', () => {
    recordScore(entry(1000), storage);
    const table = recordScore(entry(5000), storage);
    expect(table.map((e) => e.score)).toEqual([5000, 1000]);
  });

  it('clears the table', () => {
    recordScore(entry(9000), storage);
    clearScores(storage);
    expect(loadScores(storage)).toEqual([]);
  });
});

/**
 * `main.ts` reads the best score during module evaluation, so none of these may
 * throw: an exception would abort the module and leave a blank page with the
 * Clear bests control unreachable.
 */
describe('unreadable storage', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = fakeStorage();
  });

  it('treats a value that is not JSON as no games yet', () => {
    storage.setItem(STORAGE_KEY, 'not json');
    expect(loadScores(storage)).toEqual([]);
    expect(bestScore(storage)).toBeNull();
  });

  it('ignores JSON that is not a list', () => {
    storage.setItem(STORAGE_KEY, '{"score":9000}');
    expect(loadScores(storage)).toEqual([]);
  });

  it('drops entries that are not scores', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([entry(9000), null, 'nope', { percent: 4 }]));
    expect(loadScores(storage).map((e) => e.score)).toEqual([9000]);
  });

  it('recovers by overwriting the bad value on the next game', () => {
    storage.setItem(STORAGE_KEY, 'not json');
    expect(recordScore(entry(4200), storage).map((e) => e.score)).toEqual([4200]);
    expect(loadScores(storage).map((e) => e.score)).toEqual([4200]);
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

    expect(loadScores(hostile)).toEqual([]);
    expect(bestScore(hostile)).toBeNull();
    // The game still gets a table back for the dialog, just an unsaved one.
    expect(recordScore(entry(4200), hostile).map((e) => e.score)).toEqual([4200]);
    expect(() => clearScores(hostile)).not.toThrow();
  });
});
