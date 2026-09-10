import { describe, expect, it } from 'vitest';
import type { Country } from './countries';
import {
  ROUNDS_PER_GAME,
  ROUND_SECONDS,
  advanceCountryRound,
  createCountryGame,
  currentCountryTarget,
  isCountryGameOver,
  startCountryGame,
  submitCountryGuess,
  timeOutCountryRound,
} from './countryGame';
import type { Picker } from './countryGame';

const COUNTRY = (name: string, code: string): Country => ({ name, code, difficulty: 'easy' });

/** One more country than a game needs, so the picker has something to leave out. */
const FIXTURE: Country[] = [
  COUNTRY('A', 'AAA'),
  COUNTRY('B', 'BBB'),
  COUNTRY('C', 'CCC'),
  COUNTRY('D', 'DDD'),
  COUNTRY('E', 'EEE'),
  COUNTRY('F', 'FFF'),
  COUNTRY('G', 'GGG'),
  COUNTRY('H', 'HHH'),
  COUNTRY('I', 'III'),
  COUNTRY('J', 'JJJ'),
  COUNTRY('K', 'KKK'),
];

/** Deterministic stand-in for pickRandom: takes the first `count` in order. */
const takeFirst: Picker = (items, count) => items.slice(0, count);

/** A game already past the Start screen, which is what most tests are about. */
const startedGame = (seconds?: number) => {
  const game = createCountryGame('medium', FIXTURE, takeFirst, seconds);
  startCountryGame(game);
  return game;
};

describe('createCountryGame', () => {
  it('selects one target per round and carries the chosen difficulty', () => {
    const game = createCountryGame('hard', FIXTURE, takeFirst);
    expect(game.difficulty).toBe('hard');
    expect(game.targets).toHaveLength(ROUNDS_PER_GAME);
    expect(currentCountryTarget(game)?.name).toBe('A');
    expect(game.correct).toBe(0);
    expect(game.incorrect).toBe(0);
    expect(isCountryGameOver(game)).toBe(false);
  });

  it('defaults to the standard round length and accepts an override', () => {
    expect(createCountryGame('easy', FIXTURE, takeFirst).secondsPerRound).toBe(ROUND_SECONDS);
    expect(createCountryGame('easy', FIXTURE, takeFirst, 20).secondsPerRound).toBe(20);
  });

  it('has not started, so nothing can reveal a target yet', () => {
    expect(createCountryGame('easy', FIXTURE, takeFirst).started).toBe(false);
  });
});

describe('before the game is started', () => {
  it('refuses a guess, so a stray map click cannot reveal the country', () => {
    const game = createCountryGame('easy', FIXTURE, takeFirst);
    expect(submitCountryGuess(game, 'AAA')).toBeNull();
    expect(game.pending).toBeNull();
    expect(game.correct).toBe(0);
    expect(game.round).toBe(0);
  });

  it('refuses a timeout, so no round can expire unseen', () => {
    const game = createCountryGame('easy', FIXTURE, takeFirst);
    expect(timeOutCountryRound(game)).toBeNull();
    expect(game.pending).toBeNull();
  });

  it('accepts guesses once startCountryGame has run', () => {
    const game = createCountryGame('easy', FIXTURE, takeFirst);
    startCountryGame(game);
    expect(game.started).toBe(true);
    expect(submitCountryGuess(game, 'AAA')?.correct).toBe(true);
  });

  it('will not start a finished game', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      timeOutCountryRound(game);
      advanceCountryRound(game);
    }
    game.started = false;
    startCountryGame(game);
    expect(game.started).toBe(false);
  });
});

describe('submitCountryGuess', () => {
  it('marks a click inside the target correct', () => {
    const game = startedGame();
    const result = submitCountryGuess(game, 'AAA');
    expect(result?.correct).toBe(true);
    expect(result?.guessCode).toBe('AAA');
    expect(game.correct).toBe(1);
    expect(game.incorrect).toBe(0);
    expect(game.pending).not.toBeNull();
  });

  it('marks a click on the wrong country incorrect', () => {
    const game = startedGame();
    const result = submitCountryGuess(game, 'BBB');
    expect(result?.correct).toBe(false);
    expect(result?.guessCode).toBe('BBB');
    expect(game.correct).toBe(0);
    expect(game.incorrect).toBe(1);
  });

  it('marks a click that misses every country incorrect, with no guess code', () => {
    const game = startedGame();
    const result = submitCountryGuess(game, null);
    expect(result?.correct).toBe(false);
    expect(result?.guessCode).toBeNull();
    expect(game.incorrect).toBe(1);
  });

  it('ignores a second guess in the same round', () => {
    const game = startedGame();
    submitCountryGuess(game, 'AAA');
    expect(submitCountryGuess(game, 'BBB')).toBeNull();
    expect(game.correct).toBe(1); // unchanged by the ignored click
    expect(game.incorrect).toBe(0);
  });

  it('returns null once the game is over', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      submitCountryGuess(game, null);
      advanceCountryRound(game);
    }
    expect(isCountryGameOver(game)).toBe(true);
    expect(submitCountryGuess(game, 'AAA')).toBeNull();
  });
});

describe('timeOutCountryRound', () => {
  it('counts as incorrect with no guess code', () => {
    const game = startedGame();
    const result = timeOutCountryRound(game);
    expect(result?.correct).toBe(false);
    expect(result?.timedOut).toBe(true);
    expect(result?.guessCode).toBeNull();
    expect(result?.actual.name).toBe('A');
    expect(game.incorrect).toBe(1);
    expect(game.correct).toBe(0);
  });

  it('does not overwrite a guess that landed before the deadline', () => {
    const game = startedGame();
    submitCountryGuess(game, 'AAA');
    expect(timeOutCountryRound(game)).toBeNull();
    expect(game.pending?.timedOut).toBe(false);
    expect(game.correct).toBe(1);
  });

  it('blocks a guess once the round has expired', () => {
    const game = startedGame();
    timeOutCountryRound(game);
    expect(submitCountryGuess(game, 'AAA')).toBeNull();
    expect(game.correct).toBe(0);
  });

  it('advances like any other round', () => {
    const game = startedGame();
    timeOutCountryRound(game);
    advanceCountryRound(game);
    expect(game.round).toBe(1);
    expect(game.pending).toBeNull();
    expect(currentCountryTarget(game)?.name).toBe('B');
  });

  it('returns null once the game is over', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      timeOutCountryRound(game);
      advanceCountryRound(game);
    }
    expect(isCountryGameOver(game)).toBe(true);
    expect(timeOutCountryRound(game)).toBeNull();
  });
});

describe('a full game', () => {
  it('ends after every round with correct + incorrect equal to the round count', () => {
    const game = startedGame();

    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const target = currentCountryTarget(game);
      expect(target).not.toBeNull();
      submitCountryGuess(game, target!.code);
      advanceCountryRound(game);
    }

    expect(isCountryGameOver(game)).toBe(true);
    expect(currentCountryTarget(game)).toBeNull();
    expect(game.correct).toBe(ROUNDS_PER_GAME);
    expect(game.incorrect).toBe(0);
  });
});

describe('advanceCountryRound', () => {
  it('does nothing while no result is pending', () => {
    const game = startedGame();
    advanceCountryRound(game);
    expect(game.round).toBe(0);
  });
});
