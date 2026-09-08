import { describe, expect, it } from 'vitest';
import { CITIES } from './cities';
import { ROUNDS_PER_GAME } from './game';

describe('CITIES', () => {
  it('holds 500 rows, enough for any game', () => {
    expect(CITIES).toHaveLength(500);
    expect(CITIES.length).toBeGreaterThan(ROUNDS_PER_GAME);
  });

  it('has no duplicate name/country pairs', () => {
    const keys = CITIES.map((c) => `${c.name}|${c.country}`);
    expect(new Set(keys).size).toBe(CITIES.length);
  });

  it('has coordinates inside the usable map area', () => {
    for (const city of CITIES) {
      expect(city.name).not.toBe('');
      expect(city.country).not.toBe('');
      expect(city.lat).toBeGreaterThan(-85);
      expect(city.lat).toBeLessThan(85);
      expect(city.lon).toBeGreaterThanOrEqual(-180);
      expect(city.lon).toBeLessThanOrEqual(180);
    }
  });

  it('covers both hemispheres in each axis', () => {
    expect(CITIES.some((c) => c.lat < 0)).toBe(true);
    expect(CITIES.some((c) => c.lat > 0)).toBe(true);
    expect(CITIES.some((c) => c.lon < 0)).toBe(true);
    expect(CITIES.some((c) => c.lon > 0)).toBe(true);
  });
});
