import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { CITIES } from './cities';
import { countriesFor } from './countries';
import type { Difficulty } from './countries';
import { formatDistance } from './geo';
import { ratingFor } from './rating';
import { bestScore, clearScores, loadScores, recordScore } from './scores';
import type { ScoreEntry } from './scores';
import {
  bestCountryScore,
  clearCountryScores,
  loadCountryScores,
  recordCountryScore,
} from './countryScores';
import type { CountryScoreEntry } from './countryScores';
import {
  ROUNDS_PER_GAME,
  ROUND_SECONDS,
  advanceRound,
  createGame,
  currentTarget,
  isOver,
  maxScore,
  startGame,
  submitGuess,
  timeOutRound,
} from './game';
import type { Game, RoundResult } from './game';
import {
  advanceCountryRound,
  createCountryGame,
  currentCountryTarget,
  isCountryGameOver,
  startCountryGame,
  submitCountryGuess,
  timeOutCountryRound,
} from './countryGame';
import type { CountryGame, CountryRoundResult } from './countryGame';

const WORLD_CENTER: L.LatLngTuple = [20, 0];
const START_ZOOM = 2;

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`missing element #${id}`);
  return found as T;
};

/**
 * Seconds per round: `?seconds=20` in the URL overrides the default, so the length
 * can be changed for a session without a rebuild. Non-numeric or <= 0 falls back.
 */
const secondsPerRound = ((): number => {
  const raw = new URLSearchParams(window.location.search).get('seconds');
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ROUND_SECONDS;
})();

// --- Screens ---------------------------------------------------------------
// The app is one page with several top-level views, toggled with the `hidden`
// attribute: the game-selection screen, each game's own Start screen, and each
// game's board. Only one is ever visible at a time.

const SCREEN_IDS = ['select', 'app', 'country-start', 'country-app'] as const;
type ScreenId = (typeof SCREEN_IDS)[number];

const selectEl = el('select');
const appEl = el('app');
const countryStartEl = el('country-start');
const countryAppEl = el('country-app');

const screens: Record<ScreenId, HTMLElement> = {
  select: selectEl,
  app: appEl,
  'country-start': countryStartEl,
  'country-app': countryAppEl,
};

function showScreen(id: ScreenId): void {
  for (const screenId of SCREEN_IDS) {
    screens[screenId].hidden = screenId !== id;
  }
}

const selectCityButton = el<HTMLButtonElement>('select-city');
const selectCountryButton = el<HTMLButtonElement>('select-country');
const changeGameButton = el<HTMLButtonElement>('change-game');
const summaryChangeGameButton = el<HTMLButtonElement>('summary-change-game');

function backToSelect(): void {
  showScreen('select');
}

selectCityButton.addEventListener('click', () => {
  showScreen('app');
  // The map is created eagerly at module load, while this screen is still
  // hidden behind the selection screen — Leaflet cached a zero size then, so
  // it must be told to remeasure now that its container is actually visible.
  map.invalidateSize();
});
changeGameButton.addEventListener('click', backToSelect);

const roundEl = el('round');
const timerEl = el('timer');
const cityEl = el('city');
const hintEl = el('hint');
const scoreEl = el('score');
const nextButton = el<HTMLButtonElement>('next');
const mapEl = el('map');
const resultEl = el('result');
const resultDistanceEl = el('result-distance');
const resultDistanceLabelEl = el('result-distance-label');
const resultPointsEl = el('result-points');
const resultPointsLabelEl = el('result-points-label');
const resultPointsItemEl = el('result-points-item');
const summaryEl = el<HTMLDialogElement>('summary');
const summaryPointsEl = el('summary-points');
const summaryMaxEl = el('summary-max');
const summaryFillEl = el('summary-fill');
const summaryRatingEl = el('summary-rating');
const summaryEmojiEl = el('summary-emoji');
const newGameButton = el<HTMLButtonElement>('new-game');
const bestEl = el('best');
const bestsEl = el('bests');
const bestsListEl = el('bests-list');
const clearBestsButton = el<HTMLButtonElement>('clear-bests');

/** Personal best shown in the header, read once at startup. */
let best: ScoreEntry | null = bestScore();

// The whole globe is in play: no maxBounds, and minZoom 2 keeps the world visible
// in one view. Latitude is still clamped to the Mercator limits so the player
// cannot pan off the top or bottom of the tile pyramid.
const map = L.map(mapEl, {
  center: WORLD_CENTER,
  zoom: START_ZOOM,
  minZoom: 2,
  maxZoom: 8,
  maxBounds: L.latLngBounds([-85, -180], [85, 180]),
  maxBoundsViscosity: 0.5,
  worldCopyJump: true,
});

// No basemap tiles at all. Satellite imagery meant a fresh batch of JPEGs on every
// pan and zoom, and the terrain was noise for a game that only needs land shapes and
// country borders. Natural Earth's boundary GeoJSON is one cached fetch instead —
// and it carries no labels by construction, so nothing on the map names a place.
const bordersUrl = (resolution: '110m' | '50m'): string =>
  `https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_${resolution}_admin_0_countries.geojson`;

const borders = L.geoJSON(undefined, {
  // Not interactive: an interactive path swallows the click instead of letting it
  // reach the map's own handler, which is how a guess gets registered.
  interactive: false,
  style: {
    color: '#4a6a8a',
    weight: 0.8,
    fillColor: '#23364d',
    fillOpacity: 1,
  },
}).addTo(map);

map.attributionControl.addAttribution(
  'Boundaries &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
);

/**
 * Draws the coarse 1:110m outlines first so the map is usable almost immediately,
 * then swaps in 1:50m once it arrives — the reveal zooms in far enough that 110m
 * coastlines visibly miss. Each resolution is attempted independently: a failure
 * leaves whatever already rendered in place.
 */
async function loadBorders(): Promise<void> {
  for (const resolution of ['110m', '50m'] as const) {
    try {
      const response = await fetch(bordersUrl(resolution));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as GeoJSON.GeoJsonObject;
      borders.clearLayers();
      borders.addData(data);
    } catch (error) {
      console.warn(`could not load ${resolution} country borders`, error);
    }
  }
}

void loadBorders();

/** Layers for the round being shown; cleared when the player advances. */
const revealLayer = L.layerGroup().addTo(map);

const dot = (color: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/40%)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

let game: Game = createGame(CITIES, undefined, secondsPerRound);

let timerId: number | null = null;
/** Wall-clock moment the open round expires; only meaningful while timerId is set. */
let deadline = 0;

const remainingSeconds = (): number => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

/**
 * Shows or hides the action button without disturbing the stats next to it: the
 * `hidden` attribute would collapse its box and slide the whole row sideways.
 */
const setNextVisible = (visible: boolean): void => {
  nextButton.classList.toggle('is-invisible', !visible);
};

/**
 * Change game only exists before a game starts — never mid-round or once it's
 * over, so an in-progress round can't be abandoned by accident — and, like the
 * action button beside it, hides by going invisible rather than leaving the
 * flow, so the stats never shift.
 */
const setChangeGameVisible = (visible: boolean): void => {
  changeGameButton.classList.toggle('is-invisible', !visible);
};

function renderTimer(): void {
  const left = remainingSeconds();
  timerEl.textContent = `${left}s`;
  timerEl.classList.remove('idle');
  timerEl.classList.toggle('urgent', left <= 3);
}

/**
 * Blanks the clock without removing it from the layout. Hiding the whole stat made
 * the total score slide sideways every time a round opened or closed.
 */
function idleTimer(): void {
  timerEl.textContent = '—';
  timerEl.classList.remove('urgent');
  timerEl.classList.add('idle');
}

/** Starts the clock for the round now on screen. */
function startTimer(): void {
  stopTimer();
  deadline = Date.now() + secondsPerRound * 1000;
  renderTimer();
  // Ticks faster than once a second so the displayed count never lags behind.
  timerId = window.setInterval(() => {
    renderTimer();
    if (remainingSeconds() > 0) return;
    stopTimer();
    const result = timeOutRound(game);
    if (result !== null) reveal(result);
    render();
  }, 200);
}

/** Draws the answer, plus the player's pin and the line to it if they made one. */
function reveal(result: RoundResult): void {
  const actual: L.LatLngTuple = [result.actual.lat, result.actual.lon];
  L.marker(actual, { icon: dot('#e2445c') })
    .addTo(revealLayer)
    .bindTooltip(result.actual.name, {
      permanent: true,
      direction: 'top',
      className: 'marker-label',
    });

  if (result.guess === null) {
    map.setView(actual, 5);
    return;
  }

  const guess = L.latLng(result.guess.lat, result.guess.lon);
  L.marker(guess, { icon: dot('#4da3ff') }).addTo(revealLayer);
  L.polyline([guess, actual], {
    color: '#ffffff',
    weight: 2,
    dashArray: '6 6',
  }).addTo(revealLayer);
  map.fitBounds(L.latLngBounds([guess, L.latLng(actual)]).pad(0.35), { maxZoom: 7 });
}

/** Colour band for a round's points, driving `.result-points[data-tier]`. */
const tierFor = (score: number): string => {
  if (score === 0) return 'zero';
  if (score >= 700) return 'great';
  if (score < 150) return 'weak';
  return 'ok';
};

/** Fills the centred header pill with the round just played. */
function showRoundResult(result: RoundResult): void {
  if (result.distanceKm === null) {
    resultDistanceEl.textContent = '—';
    resultDistanceLabelEl.textContent = 'out of time';
  } else {
    resultDistanceEl.textContent = formatDistance(result.distanceKm);
    resultDistanceLabelEl.textContent = 'away';
  }

  resultPointsEl.textContent = result.score.toLocaleString('en-US');
  resultPointsLabelEl.textContent =
    result.bonus > 0 ? `points (+${result.bonus} fast)` : result.score === 1 ? 'point' : 'points';
  resultPointsItemEl.dataset.tier = tierFor(result.score);
  resultEl.hidden = false;
}

/** Paints the header's personal-best stat from whatever is in storage. */
function renderBest(): void {
  bestEl.textContent = best === null ? '—' : best.score.toLocaleString('en-US');
}

/** Paints the personal-bests table inside the summary dialog. */
function renderBests(entries: ScoreEntry[]): void {
  bestsListEl.replaceChildren();

  for (const item of entries) {
    const row = document.createElement('li');
    row.className = 'bests-row';
    const score = document.createElement('span');
    score.className = 'bests-score';
    score.textContent = item.score.toLocaleString('en-US');
    const meta = document.createElement('span');
    meta.className = 'bests-meta';
    meta.textContent = `${item.percent}% · ${new Date(item.playedAt).toLocaleDateString()}`;
    row.append(score, meta);
    bestsListEl.append(row);
  }
  bestsEl.hidden = entries.length === 0;
}

/** Fills in and opens the end-of-game dialog. Safe to call on repeated renders. */
function showSummary(): void {
  const max = maxScore(game);
  const percent = max === 0 ? 0 : Math.round((game.totalScore / max) * 100);

  const rating = ratingFor(percent);
  summaryPointsEl.textContent = game.totalScore.toLocaleString('en-US');
  summaryMaxEl.textContent = `/ ${max.toLocaleString('en-US')}`;
  summaryEmojiEl.textContent = rating.emoji;
  summaryRatingEl.textContent = `${percent}% of a perfect game. ${rating.verdict}`;

  const entries = recordScore({
    score: game.totalScore,
    percent,
    playedAt: new Date().toISOString(),
  });
  best = entries[0] ?? best;
  renderBest();
  renderBests(entries);

  if (!summaryEl.open) {
    summaryEl.showModal();
    // Set the width after opening so the bar animates from zero rather than
    // appearing already filled.
    summaryFillEl.style.width = '0';
    requestAnimationFrame(() => {
      summaryFillEl.style.width = `${percent}%`;
    });
  }
}

/** Discards the finished game and drops straight into round 1 of a new one. */
function newGame(): void {
  summaryEl.close();
  game = createGame(CITIES, undefined, secondsPerRound);
  startGame(game);
  revealLayer.clearLayers();
  map.setView(WORLD_CENTER, START_ZOOM);
  render();
  startTimer();
}

function render(): void {
  const target = currentTarget(game);
  scoreEl.textContent = String(game.totalScore);

  if (!game.started) {
    stopTimer();
    idleTimer();
    resultEl.hidden = true;
    hintEl.hidden = false;
    roundEl.textContent = 'Ready';
    cityEl.textContent = 'Where in the World?';
    hintEl.textContent = `${ROUNDS_PER_GAME} rounds, ${secondsPerRound} seconds each — a city you do not pin in time scores nothing.`;
    hintEl.classList.remove('result');
    nextButton.textContent = 'Start game';
    setNextVisible(true);
    setChangeGameVisible(true);
    mapEl.classList.add('locked');
    return;
  }

  if (isOver(game)) {
    stopTimer();
    idleTimer();
    resultEl.hidden = true;
    roundEl.textContent = 'Game over';
    cityEl.textContent = `${game.totalScore.toLocaleString('en-US')} points`;
    hintEl.hidden = false;
    hintEl.textContent = '';
    // The dialog carries the final score and the only action, so the header
    // button would be a second, redundant control.
    setNextVisible(false);
    setChangeGameVisible(false);
    mapEl.classList.add('locked');
    showSummary();
    return;
  }

  roundEl.textContent = `Round ${game.round + 1}/${ROUNDS_PER_GAME}`;
  cityEl.textContent = target === null ? '' : `${target.name}, ${target.country}`;

  setChangeGameVisible(false);

  if (game.pending === null) {
    renderTimer();
    resultEl.hidden = true;
    hintEl.hidden = false;
    hintEl.textContent = `Click the map where you think this city is — ${secondsPerRound}s.`;
    setNextVisible(false);
    mapEl.classList.remove('locked');
  } else {
    idleTimer();
    // The result reads in the centre pill, so the instruction line would only
    // repeat it in smaller type.
    hintEl.hidden = true;
    showRoundResult(game.pending);
    nextButton.textContent =
      game.round + 1 >= ROUNDS_PER_GAME ? 'See final score' : 'Next round';
    hintEl.hidden = true;
    hintEl.textContent = 'Space for the next round.';
    setNextVisible(true);
    mapEl.classList.add('locked');
  }
}

map.on('click', (event: L.LeafletMouseEvent) => {
  const result = submitGuess(
    game,
    { lat: event.latlng.lat, lon: event.latlng.lng },
    remainingSeconds(),
  );
  if (result === null) return; // game over, or this round's result is still showing

  stopTimer();
  reveal(result);
  render();
});

nextButton.addEventListener('click', () => {
  if (!game.started) {
    startGame(game);
    render();
    startTimer();
    return;
  }

  if (isOver(game)) {
    newGame(); // Not reachable from the UI — the dialog owns this — but harmless.
    return;
  }

  advanceRound(game);
  revealLayer.clearLayers();
  map.setView(WORLD_CENTER, START_ZOOM);
  render();
  if (!isOver(game)) startTimer();
});

newGameButton.addEventListener('click', newGame);
summaryChangeGameButton.addEventListener('click', () => {
  summaryEl.close();
  backToSelect();
});

clearBestsButton.addEventListener('click', () => {
  clearScores();
  best = null;
  renderBest();
  renderBests(loadScores());
});

// --- World Country Finder ----------------------------------------------------
// A second game: the player is named a country and clicks its shape. Unlike the
// sibling's borders, this boundary layer must be interactive so a click can be
// matched against the country it landed on — the two games each own their own
// Leaflet map and layer instance, never sharing one.

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const countryDifficultyFieldset = el<HTMLFieldSetElement>('country-difficulty');
const countryBestEl = el('country-best');
const countryLoadingEl = el('country-loading');
const countryLoadErrorEl = el('country-load-error');
const countryRetryButton = el<HTMLButtonElement>('country-retry');
const countryStartButton = el<HTMLButtonElement>('country-start-button');
const countryStartBackButton = el<HTMLButtonElement>('country-start-back');

const countryRoundEl = el('country-round');
const countryPromptEl = el('country-prompt');
const countryHintEl = el('country-hint');
const countryResultEl = el('country-result');
const countryResultItemEl = el('country-result-item');
const countryResultLabelEl = el('country-result-label');
const countryTimerEl = el('country-timer');
const countryCorrectEl = el('country-correct');
const countryIncorrectEl = el('country-incorrect');
const countryNextButton = el<HTMLButtonElement>('country-next');
const countryMapEl = el('country-map');

const countrySummaryEl = el<HTMLDialogElement>('country-summary');
const countrySummaryCorrectEl = el('country-summary-correct');
const countrySummaryMaxEl = el('country-summary-max');
const countrySummaryRatingEl = el('country-summary-rating');
const countrySummaryEmojiEl = el('country-summary-emoji');
const countryBestsEl = el('country-bests');
const countryBestsDifficultyEl = el('country-bests-difficulty');
const countryBestsListEl = el('country-bests-list');
const countryClearBestsButton = el<HTMLButtonElement>('country-clear-bests');
const countryNewGameButton = el<HTMLButtonElement>('country-new-game');
const countrySummaryChangeGameButton = el<HTMLButtonElement>('country-summary-change-game');

/** Difficulty chosen on the Start screen; carried across "New game". */
let selectedDifficulty: Difficulty = 'medium';

type BorderLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: GeoJSON.FeatureCollection }
  | { status: 'error' };

let borderState: BorderLoadState = { status: 'idle' };

/** How long a boundary fetch is given before the Start screen offers Retry. */
const COUNTRY_BORDERS_TIMEOUT_MS = 12_000;

/**
 * Fetches the 50m boundary data the country game hit-tests against. Lazy: this
 * only runs once the player selects World Country Finder, not at app load and
 * not while the sibling game is being played. Unlike the sibling's cosmetic
 * borders, shape accuracy here is gameplay-relevant, so there is no fast,
 * coarser first pass — Start stays blocked until this finishes either way.
 */
async function loadCountryBorders(): Promise<void> {
  borderState = { status: 'loading' };
  renderCountryStart();

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), COUNTRY_BORDERS_TIMEOUT_MS);
  try {
    const response = await fetch(bordersUrl('50m'), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as GeoJSON.FeatureCollection;
    borderState = { status: 'ready', data };
  } catch (error) {
    console.warn('could not load country borders', error);
    borderState = { status: 'error' };
  } finally {
    window.clearTimeout(timeout);
    renderCountryStart();
  }
}

/** Paints the Start screen: loading/error state, and the selected tier's best. */
function renderCountryStart(): void {
  countryLoadingEl.hidden = borderState.status !== 'loading';
  countryLoadErrorEl.hidden = borderState.status !== 'error';
  countryStartButton.disabled = borderState.status !== 'ready';

  const tierBest = bestCountryScore(selectedDifficulty);
  countryBestEl.textContent = `Your best on ${DIFFICULTY_LABEL[selectedDifficulty]}: ${
    tierBest === null ? '—' : `${tierBest.correct}/${ROUNDS_PER_GAME}`
  }`;
}

countryDifficultyFieldset.addEventListener('change', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.name === 'difficulty') {
    selectedDifficulty = event.target.value as Difficulty;
    renderCountryStart();
  }
});

selectCountryButton.addEventListener('click', () => {
  showScreen('country-start');
  if (borderState.status === 'idle') void loadCountryBorders();
  else renderCountryStart();
});

countryRetryButton.addEventListener('click', () => void loadCountryBorders());
countryStartBackButton.addEventListener('click', backToSelect);

/** Reads a boundary feature's country code — never its name, which the map never shows. */
function codeOf(feature: GeoJSON.Feature): string | null {
  const code = feature.properties?.['ADM0_A3'];
  return typeof code === 'string' ? code : null;
}

const COUNTRY_DEFAULT_STYLE: L.PathOptions = {
  color: '#4a6a8a',
  weight: 0.8,
  fillColor: '#23364d',
  fillOpacity: 1,
};
const COUNTRY_HOVER_FILL = '#345177';
const COUNTRY_CORRECT_STYLE: L.PathOptions = {
  color: '#2e7d4f',
  weight: 1.5,
  fillColor: '#2e9e5b',
  fillOpacity: 0.85,
};
const COUNTRY_WRONG_STYLE: L.PathOptions = {
  color: '#b3402f',
  weight: 1.5,
  fillColor: '#d1483a',
  fillOpacity: 0.85,
};
/** The correct country, outlined only — filling it would look identical to a correct click. */
const COUNTRY_TARGET_OUTLINE_STYLE: L.PathOptions = {
  color: '#f4c542',
  weight: 3,
  fillOpacity: 0,
};

let countryMap: L.Map | null = null;
let countryRevealLayer: L.LayerGroup | null = null;
let featuresByCode = new Map<string, GeoJSON.Feature>();

function handleCountryGuess(code: string | null): void {
  const result = submitCountryGuess(countryGame, code);
  if (result === null) return; // game over, or this round's result is still showing

  stopCountryTimer();
  revealCountry(result);
  renderCountryGame();
}

/**
 * Builds the country map and its interactive boundary layer once, from data
 * already fetched on the Start screen. Reused across rounds and across "New
 * game" within the same page load, exactly like the sibling's own map.
 */
function ensureCountryMap(data: GeoJSON.FeatureCollection): L.Map {
  if (countryMap !== null) return countryMap;

  countryMap = L.map(countryMapEl, {
    center: WORLD_CENTER,
    zoom: START_ZOOM,
    minZoom: 2,
    maxZoom: 8,
    maxBounds: L.latLngBounds([-85, -180], [85, 180]),
    maxBoundsViscosity: 0.5,
    worldCopyJump: true,
  });

  featuresByCode = new Map(
    data.features
      .map((feature): [string, GeoJSON.Feature] | null => {
        const code = codeOf(feature);
        return code === null ? null : [code, feature];
      })
      .filter((entry): entry is [string, GeoJSON.Feature] => entry !== null),
  );

  L.geoJSON(data, {
    // Interactive, unlike the sibling's borders: a click here must be caught by
    // the polygon it landed in, not pass through to the map's own handler.
    interactive: true,
    style: COUNTRY_DEFAULT_STYLE,
    onEachFeature: (feature, layer) => {
      const path = layer as L.Path;
      // A subtle, non-textual click affordance only — no name, no tooltip. The
      // map must never hand a player anything they haven't earned by clicking.
      layer.on('mouseover', () => path.setStyle({ fillColor: COUNTRY_HOVER_FILL }));
      layer.on('mouseout', () =>
        path.setStyle({ fillColor: COUNTRY_DEFAULT_STYLE.fillColor as string }),
      );
      layer.on('click', (event: L.LeafletMouseEvent) => {
        // Stops this click from also reaching the map's own handler below,
        // which exists to catch clicks that miss every polygon.
        L.DomEvent.stopPropagation(event);
        handleCountryGuess(codeOf(feature));
      });
    },
  }).addTo(countryMap);

  countryMap.attributionControl.addAttribution(
    'Boundaries &copy; <a href="https://www.naturalearthdata.com/">Natural Earth</a>',
  );

  // A click that lands on no polygon at all — ocean, Antarctica, a no-data area
  // — never reaches a feature's own click handler, so it's a miss.
  countryMap.on('click', () => handleCountryGuess(null));

  countryRevealLayer = L.layerGroup().addTo(countryMap);

  return countryMap;
}

/** Highlights the target (and, on a wrong click, the country actually clicked). */
function revealCountry(result: CountryRoundResult): void {
  if (countryMap === null || countryRevealLayer === null) return;
  countryRevealLayer.clearLayers();

  const shapes: L.Layer[] = [];
  const targetFeature = featuresByCode.get(result.actual.code);

  if (result.correct) {
    if (targetFeature !== undefined) {
      shapes.push(
        L.geoJSON(targetFeature, { interactive: false, style: COUNTRY_CORRECT_STYLE }).addTo(
          countryRevealLayer,
        ),
      );
    }
  } else {
    if (targetFeature !== undefined) {
      shapes.push(
        L.geoJSON(targetFeature, {
          interactive: false,
          style: COUNTRY_TARGET_OUTLINE_STYLE,
        }).addTo(countryRevealLayer),
      );
    }
    if (result.guessCode !== null) {
      const guessFeature = featuresByCode.get(result.guessCode);
      if (guessFeature !== undefined) {
        shapes.push(
          L.geoJSON(guessFeature, { interactive: false, style: COUNTRY_WRONG_STYLE }).addTo(
            countryRevealLayer,
          ),
        );
      }
    }
  }

  const bounds = L.featureGroup(shapes).getBounds();
  if (bounds.isValid()) {
    countryMap.fitBounds(bounds.pad(0.5), { maxZoom: 6 });
  } else {
    countryMap.setView(WORLD_CENTER, START_ZOOM);
  }
}

let countryGame: CountryGame = createCountryGame(selectedDifficulty, countriesFor(selectedDifficulty));

let countryTimerId: number | null = null;
let countryDeadline = 0;

const countryRemainingSeconds = (): number =>
  Math.max(0, Math.ceil((countryDeadline - Date.now()) / 1000));

function stopCountryTimer(): void {
  if (countryTimerId !== null) {
    window.clearInterval(countryTimerId);
    countryTimerId = null;
  }
}

const setCountryNextVisible = (visible: boolean): void => {
  countryNextButton.classList.toggle('is-invisible', !visible);
};

function renderCountryTimer(): void {
  const left = countryRemainingSeconds();
  countryTimerEl.textContent = `${left}s`;
  countryTimerEl.classList.remove('idle');
  countryTimerEl.classList.toggle('urgent', left <= 3);
}

function idleCountryTimer(): void {
  countryTimerEl.textContent = '—';
  countryTimerEl.classList.remove('urgent');
  countryTimerEl.classList.add('idle');
}

function startCountryTimer(): void {
  stopCountryTimer();
  countryDeadline = Date.now() + countryGame.secondsPerRound * 1000;
  renderCountryTimer();
  countryTimerId = window.setInterval(() => {
    renderCountryTimer();
    if (countryRemainingSeconds() > 0) return;
    stopCountryTimer();
    const result = timeOutCountryRound(countryGame);
    if (result !== null) revealCountry(result);
    renderCountryGame();
  }, 200);
}

/** Fills the centred header pill with the round just played. */
function showCountryRoundResult(result: CountryRoundResult): void {
  countryResultLabelEl.textContent = result.correct ? 'Correct!' : 'Incorrect';
  countryResultItemEl.dataset.tier = result.correct ? 'correct' : 'incorrect';
  countryResultEl.hidden = false;
}

/** Paints the personal-bests table inside the country summary dialog. */
function renderCountryBests(entries: CountryScoreEntry[]): void {
  countryBestsListEl.replaceChildren();

  for (const item of entries) {
    const row = document.createElement('li');
    row.className = 'bests-row';
    const score = document.createElement('span');
    score.className = 'bests-score';
    score.textContent = `${item.correct}/${ROUNDS_PER_GAME}`;
    const meta = document.createElement('span');
    meta.className = 'bests-meta';
    meta.textContent = new Date(item.playedAt).toLocaleDateString();
    row.append(score, meta);
    countryBestsListEl.append(row);
  }
  countryBestsEl.hidden = entries.length === 0;
}

/** Fills in and opens the end-of-game dialog. Safe to call on repeated renders. */
function showCountrySummary(): void {
  countrySummaryCorrectEl.textContent = String(countryGame.correct);
  countrySummaryMaxEl.textContent = `/ ${ROUNDS_PER_GAME}`;

  // Read before recording this game, so the comparison is against the table
  // as it stood before this run joined it.
  // No callout on a difficulty's very first finished game — there's no existing
  // best yet for this one to beat or tie.
  const previousBest = bestCountryScore(countryGame.difficulty);
  const isNewBest = previousBest !== null && countryGame.correct >= previousBest.correct;
  countrySummaryEmojiEl.textContent = isNewBest ? '🏆' : '🌍';
  countrySummaryRatingEl.textContent = isNewBest ? 'New best!' : '';
  countrySummaryRatingEl.hidden = !isNewBest;

  const entries = recordCountryScore(countryGame.difficulty, {
    correct: countryGame.correct,
    playedAt: new Date().toISOString(),
  });
  countryBestsDifficultyEl.textContent = DIFFICULTY_LABEL[countryGame.difficulty];
  renderCountryBests(entries);

  if (!countrySummaryEl.open) countrySummaryEl.showModal();
}

/** Returns to World Country Finder's own Start screen, difficulty pre-selected. */
function newCountryGame(): void {
  countrySummaryEl.close();
  showScreen('country-start');
  renderCountryStart();
}

function renderCountryGame(): void {
  const target = currentCountryTarget(countryGame);
  countryCorrectEl.textContent = String(countryGame.correct);
  countryIncorrectEl.textContent = String(countryGame.incorrect);

  if (!countryGame.started) {
    stopCountryTimer();
    idleCountryTimer();
    countryResultEl.hidden = true;
    countryHintEl.hidden = false;
    countryRoundEl.textContent = 'Ready';
    countryPromptEl.textContent = 'World Country Finder';
    countryHintEl.textContent = `${ROUNDS_PER_GAME} rounds, ${countryGame.secondsPerRound} seconds each — a country you don't click in time counts as incorrect.`;
    countryNextButton.textContent = 'Start game';
    setCountryNextVisible(true);
    countryMapEl.classList.add('locked');
    return;
  }

  if (isCountryGameOver(countryGame)) {
    stopCountryTimer();
    idleCountryTimer();
    countryResultEl.hidden = true;
    countryRoundEl.textContent = 'Game over';
    countryPromptEl.textContent = `${countryGame.correct}/${ROUNDS_PER_GAME} correct`;
    countryHintEl.hidden = false;
    countryHintEl.textContent = '';
    setCountryNextVisible(false);
    countryMapEl.classList.add('locked');
    showCountrySummary();
    return;
  }

  countryRoundEl.textContent = `Round ${countryGame.round + 1}/${ROUNDS_PER_GAME}`;
  countryPromptEl.textContent = target === null ? '' : `Find ${target.name}`;

  if (countryGame.pending === null) {
    renderCountryTimer();
    countryResultEl.hidden = true;
    countryHintEl.hidden = false;
    countryHintEl.textContent = `Click the country's shape on the map — ${countryGame.secondsPerRound}s.`;
    setCountryNextVisible(false);
    countryMapEl.classList.remove('locked');
  } else {
    idleCountryTimer();
    showCountryRoundResult(countryGame.pending);
    countryNextButton.textContent =
      countryGame.round + 1 >= ROUNDS_PER_GAME ? 'See final score' : 'Next round';
    countryHintEl.hidden = false;
    countryHintEl.textContent = 'Space for the next round.';
    setCountryNextVisible(true);
    countryMapEl.classList.add('locked');
  }
}

/** Begins round 1 of a new game at the difficulty chosen on the Start screen. */
function beginCountryGame(): void {
  if (borderState.status !== 'ready') return;

  showScreen('country-app');
  const activeMap = ensureCountryMap(borderState.data);
  activeMap.invalidateSize();

  countryGame = createCountryGame(selectedDifficulty, countriesFor(selectedDifficulty));
  startCountryGame(countryGame);
  countryRevealLayer?.clearLayers();
  activeMap.setView(WORLD_CENTER, START_ZOOM);
  renderCountryGame();
  startCountryTimer();
}

countryStartButton.addEventListener('click', beginCountryGame);

countryNextButton.addEventListener('click', () => {
  if (!countryGame.started) {
    // Not reachable from the UI — the Start screen owns this — but harmless.
    startCountryGame(countryGame);
    renderCountryGame();
    startCountryTimer();
    return;
  }

  if (isCountryGameOver(countryGame)) {
    newCountryGame(); // Not reachable from the UI — the dialog owns this — but harmless.
    return;
  }

  advanceCountryRound(countryGame);
  countryRevealLayer?.clearLayers();
  countryMap?.setView(WORLD_CENTER, START_ZOOM);
  renderCountryGame();
  if (!isCountryGameOver(countryGame)) startCountryTimer();
});

countryNewGameButton.addEventListener('click', newCountryGame);
countrySummaryChangeGameButton.addEventListener('click', () => {
  countrySummaryEl.close();
  backToSelect();
});

countryClearBestsButton.addEventListener('click', () => {
  clearCountryScores();
  renderCountryBests(loadCountryScores()[countryGame.difficulty]);
});

countrySummaryEl.addEventListener('cancel', (event) => {
  event.preventDefault();
});

/**
 * Keyboard shortcuts, so a game can be played without reaching for the button
 * between rounds: Space or Enter does whatever the visible game's action button
 * would do, and N starts a fresh game. Gated on which board is actually on
 * screen, so a key press on one game never drives the other's hidden state.
 */
document.addEventListener('keydown', (event: KeyboardEvent) => {
  if (event.key === ' ' || event.key === 'Enter') {
    if (!appEl.hidden) {
      if (!game.started) {
        startGame(game);
        render();
        startTimer();
        return;
      }
      if (game.pending === null) return; // round still open — the map takes the input
      advanceRound(game);
      revealLayer.clearLayers();
      map.setView(WORLD_CENTER, START_ZOOM);
      render();
      if (!isOver(game)) startTimer();
      return;
    }

    if (!countryAppEl.hidden) {
      if (!countryGame.started) {
        startCountryGame(countryGame);
        renderCountryGame();
        startCountryTimer();
        return;
      }
      if (countryGame.pending === null) return; // round still open — the map takes the input
      advanceCountryRound(countryGame);
      countryRevealLayer?.clearLayers();
      countryMap?.setView(WORLD_CENTER, START_ZOOM);
      renderCountryGame();
      if (!isCountryGameOver(countryGame)) startCountryTimer();
    }
    return;
  }

  if (event.key === 'n' || event.key === 'N') {
    if (!appEl.hidden) newGame();
    else if (!countryAppEl.hidden) newCountryGame();
  }
});

// The game is over and the dialog is the way out of it, so Escape must not
// dismiss it and leave a dead board behind.
summaryEl.addEventListener('cancel', (event) => {
  event.preventDefault();
});

renderBest();
render();
renderCountryStart();
