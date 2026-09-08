import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_SCORES, bestScore, clearScores, loadScores, recordScore } from './scores';
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

  it('clears the table', () => {
    recordScore(entry(9000), storage);
    clearScores(storage);
    expect(loadScores(storage)).toEqual([]);
  });
});
