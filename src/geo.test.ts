import { describe, expect, it } from 'vitest';
import { formatDistance, haversineKm, scoreForDistance, speedBonus } from './geo';

const PARIS = { lat: 48.8566, lon: 2.3522 };
const BERLIN = { lat: 52.52, lon: 13.405 };

describe('haversineKm', () => {
  it('matches a known distance', () => {
    expect(haversineKm(PARIS, BERLIN)).toBeCloseTo(878, -1); // ~878 km
  });

  it('is zero for identical points', () => {
    expect(haversineKm(PARIS, PARIS)).toBe(0);
  });

  it('is symmetric', () => {
    expect(haversineKm(PARIS, BERLIN)).toBeCloseTo(haversineKm(BERLIN, PARIS), 6);
  });
});

describe('scoreForDistance', () => {
  it('awards a full 1000 for a bullseye', () => {
    expect(scoreForDistance(0)).toBe(1000);
  });

  it('decays with a 2000 km scale', () => {
    expect(scoreForDistance(2000)).toBe(Math.round(1000 * Math.exp(-1)));
    expect(scoreForDistance(1000)).toBe(607);
    expect(scoreForDistance(10000)).toBe(7);
  });

  it('decreases monotonically and never goes negative', () => {
    let previous = Infinity;
    for (const km of [0, 10, 100, 500, 1000, 2000, 5000, 20000]) {
      const score = scoreForDistance(km);
      expect(score).toBeLessThanOrEqual(previous);
      expect(score).toBeGreaterThanOrEqual(0);
      previous = score;
    }
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre', () => {
    expect(formatDistance(0.42)).toBe('420 m');
  });

  it('uses whole kilometres above', () => {
    expect(formatDistance(1234.6)).toBe('1,235 km');
  });
});

describe('speedBonus', () => {
  it('is nothing on the buzzer', () => {
    expect(speedBonus(1000, 0, 10)).toBe(0);
  });

  it('is the full share with the whole clock left', () => {
    expect(speedBonus(1000, 10, 10)).toBe(200);
  });

  it('scales linearly with the time left', () => {
    expect(speedBonus(1000, 5, 10)).toBe(100);
    expect(speedBonus(500, 5, 10)).toBe(50);
  });

  it('never subtracts points', () => {
    expect(speedBonus(1000, -3, 10)).toBe(0);
  });

  it('is nothing when the round scored nothing', () => {
    expect(speedBonus(0, 10, 10)).toBe(0);
  });

  // The share is of the clock actually in play, not of a hardcoded 10 seconds:
  // half a 20-second round left is worth exactly what half a 10-second round is.
  it('measures the share against the round length it is given', () => {
    expect(speedBonus(1000, 20, 20)).toBe(200);
    expect(speedBonus(1000, 10, 20)).toBe(100);
    expect(speedBonus(1000, 5, 5)).toBe(200);
  });

  it('never pays more than the share, however much time is claimed', () => {
    expect(speedBonus(1000, 40, 10)).toBe(200);
  });

  it('is nothing when the round has no length', () => {
    expect(speedBonus(1000, 10, 0)).toBe(0);
  });
});
