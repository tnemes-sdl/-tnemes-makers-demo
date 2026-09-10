import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './style.css';

import { CITIES } from './cities';
import { formatDistance } from './geo';
import { ratingFor } from './rating';
import { bestScore, clearScores, loadScores, recordScore } from './scores';
import type { ScoreEntry } from './scores';
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
  resultPointsLabelEl.textContent = result.score === 1 ? 'point' : 'points';
  resultPointsItemEl.dataset.tier = tierFor(result.score);
  resultEl.hidden = false;
}

/** Paints the header's personal-best stat from whatever is in storage. */
function renderBest(): void {
  bestEl.textContent = best === null ? '\u2014' : best.score.toLocaleString('en-US');
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
    meta.textContent = `${item.percent}% \u00b7 ${new Date(item.playedAt).toLocaleDateString()}`;
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
    mapEl.classList.add('locked');
    showSummary();
    return;
  }

  roundEl.textContent = `Round ${game.round + 1}/${ROUNDS_PER_GAME}`;
  cityEl.textContent = target === null ? '' : `${target.name}, ${target.country}`;

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
    setNextVisible(true);
    mapEl.classList.add('locked');
  }
}

map.on('click', (event: L.LeafletMouseEvent) => {
  const result = submitGuess(game, { lat: event.latlng.lat, lon: event.latlng.lng });
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

clearBestsButton.addEventListener('click', () => {
  clearScores();
  best = null;
  renderBest();
  renderBests(loadScores());
});

// The game is over and the dialog is the way out of it, so Escape must not
// dismiss it and leave a dead board behind.
summaryEl.addEventListener('cancel', (event) => {
  event.preventDefault();
});

renderBest();
render();
