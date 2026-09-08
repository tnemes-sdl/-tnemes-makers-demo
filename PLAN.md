# Implementation Plan — European City Guessing Game

## Goal

Five rounds. Each round shows a European city name; the player clicks the map; the
game reveals the true location, the error distance in km, and a score. After round 5,
show the total and offer a replay.

Scope is deliberately tight: no accounts, no persistence, no backend, no build of a
custom map — one page, one session, refresh to reset.

## Steps

### 1. Scaffold
`npm create vite@latest . -- --template vanilla-ts`, then add `leaflet`,
`@types/leaflet`, and `vitest`. Add `typecheck` (`tsc --noEmit`) and `test` scripts.
Add a `.gitignore` covering `node_modules/`, `dist/`, and `.idea/`.

### 2. `src/cities.ts`
Export `type City = { name: string; country: string; lat: number; lon: number }` and
a `CITIES: City[]` array of ~30 hardcoded European cities, spread across the
continent and mixed in difficulty (Paris and Lisbon alongside Ljubljana and Vilnius).
Hardcoded because 30 rows of data beats a geocoding dependency.

### 3. `src/geo.ts` — pure math
- `haversineKm(a: LatLon, b: LatLon): number` — great-circle distance, R = 6371 km.
- `scoreForDistance(km: number): number` — `Math.round(1000 * Math.exp(-km / 500))`.
  Exponential decay: a bullseye is ~1000, ~350 at 500 km, ~14 at 2000 km. Rewards
  precision without making a far-off guess feel like a total loss.

### 4. `src/game.ts` — state, no DOM
- `createGame(cities, pickRandom)`: selects 5 distinct cities up front. The random
  picker is injected so tests can pass a deterministic stub.
- `submitGuess(game, latlon)`: returns `{ actual, distanceKm, score, roundsLeft }`
  and advances the round. Guards against a second guess in the same round.
- Track `totalScore` and `isOver`.

### 5. `src/main.ts` — rendering
- Init Leaflet on `#map` with Esri World Imagery tiles (no labels of any kind),
  centered ~`(54, 15)` at zoom 4,
  with `maxBounds` around Europe so the player can't wander to Australia.
- Header shows `Round N/5`, the target city name, and the running total.
- On map click: call `submitGuess`, drop a marker at the guess, a marker at the truth,
  a polyline between them, and show `"312 km away — 535 points"`.
- A **Next round** button clears the layers and advances; after round 5 it becomes
  **Play again** and the panel shows the final total.
- Ignore clicks while a round's result is showing.

### 6. `src/geo.test.ts`
- Haversine against a known pair (Paris→Berlin ≈ 878 km, allow ±10 km) and zero for
  identical points.
- `scoreForDistance`: 0 km → 1000, monotonically decreasing, never negative.
- One `game.ts` test with a stubbed picker: five guesses end the game and the total
  equals the sum of round scores.

### 7. `style.css`
Full-height flex layout: map fills the space, a fixed panel on top for prompt and
result. Minimal, legible, no design system.

## Verification

1. `npm run typecheck` and `npm test` both clean.
2. `npm run dev`, then play a full five-round game in the browser: confirm the city
   prompt changes each round, the two markers and the connecting line appear, the
   distance looks plausible against a real map, the total accumulates, and
   **Play again** resets to round 1 with a fresh set of cities.
3. Click the map twice quickly in one round — the second click must be ignored.

## Deliberately out of scope

Timers, difficulty levels, leaderboards, mobile-specific layout, offline tiles,
a city database beyond the hardcoded list.
