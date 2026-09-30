/**
 * Head-to-head measuring stick for AI scoring changes.
 *
 * DEVELOPMENT ONLY. Plays engine-vs-engine games where the two sides differ
 * ONLY by an AiWallTuning override, and reports the result PER COLOUR SLOT.
 *
 * Per-colour reporting is not optional. 2p self-play is dominated by
 * first-player advantage (a first pass had one side winning 10/10 as P0 and
 * 0/10 as P1), so any aggregate win rate mostly measures who went first. Every
 * number below is therefore split by which colour slot the tuned engine had.
 *
 * Usage:  npx tsx h2h.tmp.ts [games] [difficulty] [seed]
 *   games      total games, always even and split evenly across both slots
 *   difficulty easy | normal | hard   (default normal, for runtime)
 *   seed       base seed (default 1)
 */
import { createInitialState, applyAction, bestRemainingPlace } from './src/ruleset.js';
import { getBestAction, AI_PROFILES, DEFAULT_WALL_TUNING } from './src/ai.js';
import type { AiWallTuning } from './src/ai.js';
import type { AIDifficulty, GameState } from './src/types.js';

const GAMES = Number(process.argv[2] ?? 120);
const DIFF = (process.argv[3] ?? 'normal') as AIDifficulty;
const BASE_SEED = Number(process.argv[4] ?? 1);

const profile = AI_PROFILES[DIFF];

/** The change under test: denial-as-tempo on, everything else default. */
const TUNED: Partial<AiWallTuning> = { denialIsTempo: true };
/** The control: exactly the shipped default, which also charges wall tempo. */
const BASELINE: Partial<AiWallTuning> = { ...DEFAULT_WALL_TUNING, denialIsTempo: false };

type Side = 0 | 1;

interface GameResult {
  winner: Side | null;
  plies: number;
  tunedWalls: number;
  baseWalls: number;
}

function playOne(tunedSeat: Side, seed: number): GameResult {
  let state: GameState = createInitialState({ mode: '2p' });
  let tunedWalls = 0;
  let baseWalls = 0;
  let plies = 0;

  while (state.status === 'IN_PROGRESS' && plies < 400) {
    const mover = state.players[state.currentPlayerIndex];
    if (!mover) break;
    const isTuned = mover.index === tunedSeat;
    const action = getBestAction(
      state,
      profile,
      seed + plies,
      undefined,
      isTuned ? TUNED : BASELINE
    );
    if (!action) break;
    if (action.type === 'PLACE_WALL') {
      if (isTuned) tunedWalls++;
      else baseWalls++;
    }
    const res = applyAction(state, action);
    if (!res.success) break;
    state = res.state;
    plies++;
  }

  let winner: Side | null = null;
  if (state.status === 'COMPLETED' && state.winnerId) {
    const w = state.players.find((p) => p.id === state.winnerId);
    if (w) winner = w.index === 0 ? 0 : 1;
  }
  return { winner, plies, tunedWalls, baseWalls };
}

/** Wilson score interval, 95%. Correct at the extremes where normal approx lies. */
function wilson(wins: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.959964;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

function fmt(label: string, wins: number, n: number): string {
  const [lo, hi] = wilson(wins, n);
  const pct = n === 0 ? 0 : (wins / n) * 100;
  return (
    `  ${label.padEnd(26)} ${String(wins).padStart(3)}/${String(n).padEnd(3)}` +
    ` = ${pct.toFixed(1).padStart(5)}%   95% CI [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`
  );
}

// ---------------------------------------------------------------------------
// Sanity check: the override must actually change behaviour. If tuned and
// baseline pick the same action everywhere, the wiring is broken and every
// number below would be noise.
// ---------------------------------------------------------------------------
let diverged = 0;
let probed = 0;
for (let g = 0; g < 6; g++) {
  let state = createInitialState({ mode: '2p' });
  for (let ply = 0; ply < 14 && state.status === 'IN_PROGRESS'; ply++) {
    const mover = state.players[state.currentPlayerIndex];
    if (!mover) break;
    const a = getBestAction(state, profile, 777 + ply, undefined, TUNED);
    const b = getBestAction(state, profile, 777 + ply, undefined, BASELINE);
    if (a && b) {
      probed++;
      const ka = `${a.type}:${'wall' in a ? `${a.wall.row},${a.wall.col},${a.wall.orientation}` : `${(a as any).to.row},${(a as any).to.col}`}`;
      const kb = `${b.type}:${'wall' in b ? `${b.wall.row},${b.wall.col},${b.wall.orientation}` : `${(b as any).to.row},${(b as any).to.col}`}`;
      if (ka !== kb) diverged++;
    }
    if (!a) break;
    const res = applyAction(state, a);
    if (!res.success) break;
    state = res.state;
  }
}
console.log(`sanity: ${diverged}/${probed} plies where tuned and baseline chose DIFFERENT actions`);
if (diverged === 0) {
  console.log('FATAL: tuning is not reaching the engine — fix the wiring before trusting any result.');
  process.exit(1);
}
console.log(`\ndifficulty=${DIFF}  games=${GAMES}  baseSeed=${BASE_SEED}\n`);

// ---------------------------------------------------------------------------
// Main run, alternating which colour slot the tuned engine occupies.
// ---------------------------------------------------------------------------
const per = Math.floor(GAMES / 2);
let tunedAsFirstWins = 0;
let tunedAsSecondWins = 0;
let draws = 0;
let tunedWalls = 0;
let baseWalls = 0;
let plies = 0;
let firstSeatWins = 0;

for (let g = 0; g < per; g++) {
  const seatA: Side = g % 2 === 0 ? 0 : 1;
  const r = playOne(seatA, BASE_SEED + g * 1000);
  plies += r.plies;
  tunedWalls += r.tunedWalls;
  baseWalls += r.baseWalls;
  if (r.winner === null) {
    draws++;
    continue;
  }
  if (r.winner === 0) firstSeatWins++;
  if (r.winner === seatA) {
    if (seatA === 0) tunedAsFirstWins++;
    else tunedAsSecondWins++;
  }
}

console.log('per colour slot (the number that matters):');
console.log(fmt('tuned as FIRST (seat 0)', tunedAsFirstWins, per));
console.log(fmt('tuned as SECOND (seat 1)', tunedAsSecondWins, per));
console.log('');
console.log(`  draws / unfinished: ${draws}`);
console.log(`  seat 0 win rate (first-player advantage): ${((firstSeatWins / Math.max(1, per * 2 - draws)) * 100).toFixed(1)}%`);
console.log(`  mean plies/game: ${(plies / per).toFixed(1)}`);
console.log(
  `  walls placed per game: tuned ${(tunedWalls / per).toFixed(2)}, baseline ${(baseWalls / per).toFixed(2)}`
);

const [loF, hiF] = wilson(tunedAsFirstWins, per);
const [loS, hiS] = wilson(tunedAsSecondWins, per);
const betterAsFirst = loF > 0.5;
const betterAsSecond = loS > 0.5;
const betterAsSecondOnly = loS > 0.5 && hiF >= 0.5;
const betterAsFirstOnly = loF > 0.5 && hiS >= 0.5;

console.log('');
if (betterAsFirst && betterAsSecond) {
  console.log('VERDICT: tuned wins in BOTH colour slots beyond 95% confidence — real gain.');
} else if (betterAsSecondOnly) {
  console.log('VERDICT: tuned wins only as SECOND. Sits above 50% only because going');
  console.log('         first is already an advantage, so this is NOT a demonstrated gain.');
} else if (betterAsFirstOnly) {
  console.log('VERDICT: tuned wins only as FIRST — indistinguishable from first-move bias.');
} else {
  console.log('VERDICT: tuned does not beat baseline beyond 95% confidence in either slot.');
  console.log('         No strength claim. Either the change is neutral or it costs more than it earns.');
}
