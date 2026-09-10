import type { Country, Difficulty } from './countries';
import { ROUNDS_PER_GAME, ROUND_SECONDS, pickRandom } from './game';
import type { Picker } from './game';

export { ROUNDS_PER_GAME, ROUND_SECONDS, pickRandom };
export type { Picker };

export type CountryGame = {
  difficulty: Difficulty;
  /** The countries for this game, one per round. */
  targets: Country[];
  /**
   * False until the player presses Start. Guesses and timeouts are both
   * refused while it is false, so nothing can reveal a target before the
   * game begins.
   */
  started: boolean;
  /** Index of the round in progress; equals targets.length once the game is over. */
  round: number;
  correct: number;
  incorrect: number;
  secondsPerRound: number;
  /** Result of the round just played, or null if the round is still open. */
  pending: CountryRoundResult | null;
};

export type CountryRoundResult = {
  /** Code of the country clicked, or null if the click missed every country
   * (ocean, Antarctica, no-data area) or the round ran out of time unanswered. */
  guessCode: string | null;
  actual: Country;
  correct: boolean;
  timedOut: boolean;
};

export function createCountryGame(
  difficulty: Difficulty,
  countries: readonly Country[],
  picker: Picker = pickRandom,
  secondsPerRound: number = ROUND_SECONDS,
): CountryGame {
  return {
    difficulty,
    targets: picker(countries, ROUNDS_PER_GAME),
    started: false,
    round: 0,
    correct: 0,
    incorrect: 0,
    secondsPerRound,
    pending: null,
  };
}

/** Opens the first round. Ignored if the game is already under way or finished. */
export function startCountryGame(game: CountryGame): void {
  if (isCountryGameOver(game)) return;
  game.started = true;
}

export function currentCountryTarget(game: CountryGame): Country | null {
  return game.targets[game.round] ?? null;
}

export function isCountryGameOver(game: CountryGame): boolean {
  return game.round >= game.targets.length;
}

/**
 * Scores a click against the current round's country and records the result.
 * `guessCode` is the clicked polygon's code, or null if the click missed every
 * country. Returns null if the game has not started, is over, or this round's
 * result has not been dismissed — the caller should ignore such clicks rather
 * than treat them as new guesses, the same gate `submitGuess` uses in the
 * sibling game.
 */
export function submitCountryGuess(
  game: CountryGame,
  guessCode: string | null,
): CountryRoundResult | null {
  const actual = currentCountryTarget(game);
  if (!game.started || actual === null || game.pending !== null) return null;

  const correct = guessCode !== null && guessCode === actual.code;
  const result: CountryRoundResult = {
    guessCode,
    actual,
    correct,
    timedOut: false,
  };
  game.pending = result;
  if (correct) game.correct += 1;
  else game.incorrect += 1;
  return result;
}

/**
 * Ends the round with no guess, for when the clock runs out. Returns null if
 * the game has not started, is over, or already has a result showing — a late
 * timer tick must never overwrite a guess the player got in just before the
 * deadline, nor expire a round nobody has seen yet.
 */
export function timeOutCountryRound(game: CountryGame): CountryRoundResult | null {
  const actual = currentCountryTarget(game);
  if (!game.started || actual === null || game.pending !== null) return null;

  const result: CountryRoundResult = {
    guessCode: null,
    actual,
    correct: false,
    timedOut: true,
  };
  game.pending = result;
  game.incorrect += 1;
  return result;
}

/** Clears the shown result and moves to the next round. */
export function advanceCountryRound(game: CountryGame): void {
  if (game.pending === null) return;
  game.pending = null;
  game.round += 1;
}
