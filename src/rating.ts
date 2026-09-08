/**
 * End-of-game verdicts. Pure and DOM-free so the whole ladder is unit-testable;
 * `main.ts` only paints what this returns.
 */
export type Rating = {
  /** Lowest percentage of a perfect game that earns this verdict. */
  floor: number;
  /** Decorative — the verdict text carries the same meaning for screen readers. */
  emoji: string;
  verdict: string;
};

const BEGINNER: Rating = {
  floor: 0,
  emoji: '🌱',
  verdict: 'Everyone starts somewhere.',
};

/** Highest threshold first, so the first match wins. */
export const RATINGS: readonly Rating[] = [
  { floor: 85, emoji: '🏆', verdict: 'Outstanding — you know this planet.' },
  { floor: 70, emoji: '🎯', verdict: 'Strong showing.' },
  { floor: 50, emoji: '🧭', verdict: 'Solid work.' },
  { floor: 30, emoji: '🗺️', verdict: 'Some good instincts in there.' },
  { floor: 10, emoji: '🤔', verdict: 'A few near misses.' },
  BEGINNER,
];

/** The verdict for a score expressed as a percentage of a perfect game. */
export function ratingFor(percent: number): Rating {
  return RATINGS.find(({ floor }) => percent >= floor) ?? BEGINNER;
}
