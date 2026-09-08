import type { City } from './cities';
import { haversineKm, scoreForDistance } from './geo';
import type { LatLon } from './geo';

export const ROUNDS_PER_GAME = 10;

/**
 * Seconds a player gets to place a pin before the round is scored zero.
 * Configurable per game via `createGame`; this is the default.
 */
export const ROUND_SECONDS = 10;

export type Game = {
  /** The cities for this game, one per round. */
  targets: City[];
  /**
   * False until the player presses Start. Guesses and timeouts are both refused
   * while it is false, so nothing can reveal a target before the game begins.
   */
  started: boolean;
  /** Index of the round in progress; equals targets.length once the game is over. */
  round: number;
  totalScore: number;
  /** Seconds allowed per round; held on the game so it can be configured. */
  secondsPerRound: number;
  /** Result of the round just played, or null if the round is still open. */
  pending: RoundResult | null;
};

export type RoundResult = {
  /** The pin the player placed, or null if the round ran out of time unanswered. */
  guess: LatLon | null;
  actual: City;
  /** Distance from the pin, or null if the round ran out of time unanswered. */
  distanceKm: number | null;
  score: number;
  timedOut: boolean;
};

/** Picks `count` distinct items. Injected so tests can pass a deterministic stub. */
export type Picker = <T>(items: readonly T[], count: number) => T[];

export const pickRandom: Picker = (items, count) => {
  const pool = [...items];
  const chosen: typeof pool = [];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const [item] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    if (item !== undefined) chosen.push(item);
  }
  return chosen;
};

export function createGame(
  cities: readonly City[],
  picker: Picker = pickRandom,
  secondsPerRound: number = ROUND_SECONDS,
): Game {
  return {
    targets: picker(cities, ROUNDS_PER_GAME),
    started: false,
    round: 0,
    totalScore: 0,
    secondsPerRound,
    pending: null,
  };
}

/** Opens the first round. Ignored if the game is already under way or finished. */
export function startGame(game: Game): void {
  if (isOver(game)) return;
  game.started = true;
}

export function currentTarget(game: Game): City | null {
  return game.targets[game.round] ?? null;
}

export function isOver(game: Game): boolean {
  return game.round >= game.targets.length;
}

/**
 * Scores a guess against the current round's city and records the result.
 * Returns null if the game has not started, is over, or this round's result has not
 * been dismissed — the caller should ignore such clicks rather than treat them as
 * new guesses. This is the only gate that matters: the map's `locked` class is
 * cosmetic and does not stop a click from arriving.
 */
export function submitGuess(game: Game, guess: LatLon): RoundResult | null {
  const actual = currentTarget(game);
  if (!game.started || actual === null || game.pending !== null) return null;

  const distanceKm = haversineKm(guess, { lat: actual.lat, lon: actual.lon });
  const result: RoundResult = {
    guess,
    actual,
    distanceKm,
    score: scoreForDistance(distanceKm),
    timedOut: false,
  };
  game.pending = result;
  game.totalScore += result.score;
  return result;
}

/**
 * Ends the round with no guess and no points, for when the clock runs out.
 * Returns null if the game has not started, is over, or already has a result
 * showing — a late timer tick must never overwrite a guess the player got in just
 * before the deadline, nor expire a round nobody has seen yet.
 */
export function timeOutRound(game: Game): RoundResult | null {
  const actual = currentTarget(game);
  if (!game.started || actual === null || game.pending !== null) return null;

  const result: RoundResult = {
    guess: null,
    actual,
    distanceKm: null,
    score: 0,
    timedOut: true,
  };
  game.pending = result;
  return result;
}

/** Clears the shown result and moves to the next round. */
export function advanceRound(game: Game): void {
  if (game.pending === null) return;
  game.pending = null;
  game.round += 1;
}

export const maxScore = (game: Game): number => game.targets.length * 1000;
