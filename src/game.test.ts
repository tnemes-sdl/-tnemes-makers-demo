import { describe, expect, it } from 'vitest';
import type { City } from './cities';
import {
  ROUNDS_PER_GAME,
  ROUND_SECONDS,
  advanceRound,
  createGame,
  currentTarget,
  isOver,
  pickRandom,
  startGame,
  submitGuess,
  timeOutRound,
} from './game';
import type { Picker } from './game';

const CITY = (name: string, lat: number, lon: number): City => ({
  name,
  country: 'Testland',
  lat,
  lon,
});

/** One more city than a game needs, so pickRandom has something to leave out. */
const FIXTURE: City[] = [
  CITY('A', 50, 10),
  CITY('B', 40, 0),
  CITY('C', 60, 20),
  CITY('D', 45, 5),
  CITY('E', 55, 15),
  CITY('F', 35, -5),
  CITY('G', -20, 150),
  CITY('H', -35, -58),
  CITY('I', 35, 139),
  CITY('J', 0, 30),
  CITY('K', 25, -80),
];

/** Deterministic stand-in for pickRandom: takes the first `count` in order. */
const takeFirst: Picker = (items, count) => items.slice(0, count);

/** A game already past the Start screen, which is what most tests are about. */
const startedGame = (seconds?: number) => {
  const game = createGame(FIXTURE, takeFirst, seconds);
  startGame(game);
  return game;
};

describe('createGame', () => {
  it('selects one target per round', () => {
    const game = createGame(FIXTURE, takeFirst);
    expect(game.targets).toHaveLength(ROUNDS_PER_GAME);
    expect(currentTarget(game)?.name).toBe('A');
    expect(game.totalScore).toBe(0);
    expect(isOver(game)).toBe(false);
  });

  it('defaults to the standard round length and accepts an override', () => {
    expect(createGame(FIXTURE, takeFirst).secondsPerRound).toBe(ROUND_SECONDS);
    expect(createGame(FIXTURE, takeFirst, 20).secondsPerRound).toBe(20);
  });

  it('has not started, so nothing can reveal a target yet', () => {
    expect(createGame(FIXTURE, takeFirst).started).toBe(false);
  });
});

describe('before the game is started', () => {
  it('refuses a guess, so a stray map click cannot reveal the city', () => {
    const game = createGame(FIXTURE, takeFirst);
    expect(submitGuess(game, { lat: 50, lon: 10 })).toBeNull();
    expect(game.pending).toBeNull();
    expect(game.totalScore).toBe(0);
    expect(game.round).toBe(0);
  });

  it('refuses a timeout, so no round can expire unseen', () => {
    const game = createGame(FIXTURE, takeFirst);
    expect(timeOutRound(game)).toBeNull();
    expect(game.pending).toBeNull();
  });

  it('accepts guesses once startGame has run', () => {
    const game = createGame(FIXTURE, takeFirst);
    startGame(game);
    expect(game.started).toBe(true);
    expect(submitGuess(game, { lat: 50, lon: 10 })?.score).toBe(1000);
  });

  it('will not start a finished game', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      timeOutRound(game);
      advanceRound(game);
    }
    game.started = false;
    startGame(game);
    expect(game.started).toBe(false);
  });
});

describe('timeOutRound', () => {
  it('scores the round zero and leaves the total untouched', () => {
    const game = startedGame();
    const result = timeOutRound(game);
    expect(result?.score).toBe(0);
    expect(result?.timedOut).toBe(true);
    expect(result?.guess).toBeNull();
    expect(result?.distanceKm).toBeNull();
    expect(result?.actual.name).toBe('A');
    expect(game.totalScore).toBe(0);
  });

  it('does not overwrite a guess that landed before the deadline', () => {
    const game = startedGame();
    submitGuess(game, { lat: 50, lon: 10 });
    expect(timeOutRound(game)).toBeNull();
    expect(game.pending?.timedOut).toBe(false);
    expect(game.totalScore).toBe(1000);
  });

  it('blocks a guess once the round has expired', () => {
    const game = startedGame();
    timeOutRound(game);
    expect(submitGuess(game, { lat: 50, lon: 10 })).toBeNull();
    expect(game.totalScore).toBe(0);
  });

  it('advances like any other round', () => {
    const game = startedGame();
    timeOutRound(game);
    advanceRound(game);
    expect(game.round).toBe(1);
    expect(game.pending).toBeNull();
    expect(currentTarget(game)?.name).toBe('B');
  });

  it('returns null once the game is over', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      timeOutRound(game);
      advanceRound(game);
    }
    expect(isOver(game)).toBe(true);
    expect(timeOutRound(game)).toBeNull();
    expect(game.totalScore).toBe(0);
  });
});

describe('pickRandom', () => {
  it('returns distinct items', () => {
    const picked = pickRandom(FIXTURE, ROUNDS_PER_GAME);
    expect(picked).toHaveLength(ROUNDS_PER_GAME);
    expect(new Set(picked.map((c) => c.name)).size).toBe(ROUNDS_PER_GAME);
  });

  it('caps at the pool size', () => {
    expect(pickRandom(FIXTURE.slice(0, 2), 5)).toHaveLength(2);
  });
});

describe('submitGuess', () => {
  it('scores a perfect guess and holds the result', () => {
    const game = startedGame();
    const result = submitGuess(game, { lat: 50, lon: 10 });
    expect(result?.score).toBe(1000);
    expect(result?.distanceKm).toBe(0);
    expect(game.totalScore).toBe(1000);
    expect(game.pending).not.toBeNull();
  });

  it('ignores a second guess in the same round', () => {
    const game = startedGame();
    submitGuess(game, { lat: 50, lon: 10 });
    expect(submitGuess(game, { lat: 0, lon: 0 })).toBeNull();
    expect(game.totalScore).toBe(1000); // unchanged by the ignored click
  });

  it('returns null once the game is over', () => {
    const game = startedGame();
    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      submitGuess(game, { lat: 0, lon: 0 });
      advanceRound(game);
    }
    expect(isOver(game)).toBe(true);
    expect(submitGuess(game, { lat: 50, lon: 10 })).toBeNull();
  });
});

describe('a full game', () => {
  it('ends after every round with the total equal to the sum of round scores', () => {
    const game = startedGame();
    let expected = 0;

    for (let i = 0; i < ROUNDS_PER_GAME; i++) {
      const target = currentTarget(game);
      expect(target).not.toBeNull();
      const result = submitGuess(game, { lat: target!.lat, lon: target!.lon });
      expected += result?.score ?? 0;
      advanceRound(game);
    }

    expect(isOver(game)).toBe(true);
    expect(currentTarget(game)).toBeNull();
    expect(game.totalScore).toBe(expected);
    expect(game.totalScore).toBe(ROUNDS_PER_GAME * 1000);
  });
});

describe('advanceRound', () => {
  it('does nothing while no result is pending', () => {
    const game = startedGame();
    advanceRound(game);
    expect(game.round).toBe(0);
  });
});
