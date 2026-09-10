import { describe, expect, it } from 'vitest';
import { RATINGS, ratingFor } from './rating';

describe('ratingFor', () => {
  it('picks the band each percentage falls in', () => {
    expect(ratingFor(100).emoji).toBe('🏆');
    expect(ratingFor(85).emoji).toBe('🏆');
    expect(ratingFor(84).emoji).toBe('🎯');
    expect(ratingFor(70).emoji).toBe('🎯');
    expect(ratingFor(50).emoji).toBe('🧭');
    expect(ratingFor(30).emoji).toBe('🗺️');
    expect(ratingFor(10).emoji).toBe('🤔');
    expect(ratingFor(9).emoji).toBe('🌱');
    expect(ratingFor(0).emoji).toBe('🌱');
  });

  it('never falls through, even for out-of-range input', () => {
    for (const percent of [-5, 0, 42, 100, 250]) {
      const rating = ratingFor(percent);
      expect(rating.emoji).not.toBe('');
      expect(rating.verdict).not.toBe('');
    }
  });

  it('has one emoji and one verdict per band, all distinct', () => {
    expect(new Set(RATINGS.map((r) => r.emoji)).size).toBe(RATINGS.length);
    expect(new Set(RATINGS.map((r) => r.verdict)).size).toBe(RATINGS.length);
  });

  it('is ordered highest threshold first, so the first match wins', () => {
    const floors = RATINGS.map((r) => r.floor);
    expect(floors).toEqual([...floors].sort((a, b) => b - a));
    expect(floors.at(-1)).toBe(0);
  });
});
