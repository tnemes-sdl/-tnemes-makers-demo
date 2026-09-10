# tnemes-makers-demo

A small browser game: the player is shown a random city name from anywhere in the
world and clicks on a world map where they think it is. Points are awarded by how
close the guess was; a game is 10 rounds, each on a 10-second clock — no pin in
time scores zero.
Built for a single training session — small on purpose.

## Stack

- TypeScript (strict, ESM), no UI framework — plain DOM + a few modules.
- Vite for dev server and build.
- Leaflet for the map. No basemap tiles: the map is Natural Earth's country
  boundary GeoJSON (`ne_*_admin_0_countries`, fetched keyless from jsDelivr) drawn
  as a vector layer over a flat ocean colour. No terrain, no labels. Max zoom 8.
- Vitest for unit tests on the scoring/distance math.

Requires network at runtime for the boundary GeoJSON (one cached fetch, not tiles).

## Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Test: `npm test`
- Typecheck: `npm run typecheck`

## Layout

- `index.html` — single page, mounts the game. Opens on a Start screen; the clock
  only begins once the player presses the button. Ends on a native `<dialog>`
  showing the final score and the New game button.
- `src/main.ts` — game loop and DOM wiring.
- `src/game.ts` — round/score/timer state, framework-free and testable.
- `src/geo.ts` — haversine distance and distance-to-score.
- `src/rating.ts` — end-of-game verdict bands (emoji + wording) by percentage.
- `src/cities.ts` — hardcoded city list of 500 world cities (name, country, lat, lon).
- `src/*.test.ts` — colocated tests.

## Conventions

- Named exports over default exports.
- The header is a three-column grid (prompt / round result / stats). Nothing in it
  may shift as the round state changes, which takes three separate things: each
  child pins its own `grid-column` (a `display: none` pill otherwise leaves two
  items and the stats slide into the middle column); `.stat` has a `min-width` wide
  enough for "TOTAL SCORE" and a five-figure total; and the action button holds one
  `min-width` for every label and hides via `.is-invisible` (visibility) rather than
  the `hidden` attribute, which would collapse its box and drag the stats sideways.
  The clock likewise stays in the layout between rounds, showing a muted em dash.
  Verify changes here by measuring `getBoundingClientRect()` across states, not by
  eyeballing screenshots — the jumps are easy to miss and easy to reintroduce.
- Any element given an author `display` rule needs its own `[hidden] { display: none }`,
  or the `hidden` attribute silently does nothing — this bit `.stat` and `.result`.
- Gate player actions in `game.ts`, not in `main.ts`. `#map.locked` only changes the
  cursor; the Leaflet click handler still fires, so a guess must be refused by
  `submitGuess` itself. A `started` flag kept only in `main.ts` let a pre-Start click
  score a round and reveal the city.
- Keep pure logic (`geo.ts`, `game.ts`) free of DOM and Leaflet imports so it stays
  unit-testable; all rendering lives in `main.ts`. The round clock follows this
  split: `game.ts` owns `ROUND_SECONDS` and `timeOutRound`, while the `setInterval`
  that fires it lives in `main.ts`.
- Round length is configurable: `ROUND_SECONDS` is the default, `createGame`'s third
  argument overrides it, and `?seconds=20` in the URL sets it without a rebuild.
- Latitude/longitude order is always `(lat, lon)` — matching Leaflet's `LatLng`.

## Notes for Claude

- Ask before adding dependencies; the dependency list above is the whole budget.
- Never let labels back onto the map — they hand over the answer. No keyless raster
  basemap gives borders without labels: Esri's Light Gray/Dark Gray canvases bake
  country names into the tile image, and CARTO's label-free style needs an API key
  (it answers HTTP 200 with an "API key required" watermark, so a status check will
  not catch it). Both re-checked and still true. Esri World Imagery is label-free
  but is satellite terrain, which is heavy to load and visually noisy — that is why
  the map is boundary vectors now and not tiles at all.
- When changing basemaps, open a tile and *look at it* — a status code will not tell
  you whether the image carries labels or a watermark.
- The boundary layer loads 1:110m first for a fast first paint, then swaps in 1:50m.
  Keep it `interactive: false`: an interactive path swallows the click instead of
  letting it reach the map handler, which is how a guess is registered.
- 1:50m simplification puts coastal cities up to ~6 km offshore of the drawn
  coastline (median ~1.7 km). Scoring is unaffected — haversine uses the real city
  coordinates, never the polygons — so this is cosmetic. Don't reach for 1:10m to
  "fix" it; that file is many megabytes.
- After changing a dependency, restart the dev server with `npm run dev -- --force`.
  Vite's pre-bundled dep cache goes stale and serves 504s for
  `/node_modules/.vite/deps/*.js` until it is rebuilt.
- The summary's emoji is decorative and `aria-hidden`: the rating sentence beside it
  already states the verdict in words, so announcing both would be a duplicate.
- The end-of-game summary is a native `<dialog>` opened with `showModal()` — no
  library, and it gets focus trapping and a `::backdrop` for free. Its `cancel`
  event is suppressed so Escape cannot dismiss it and leave a dead board with no
  way to start again.
- Don't reach for a framework or state library — the game is a handful of modules.
- `.idea/` is IntelliJ's local config: gitignore it, don't edit it.
