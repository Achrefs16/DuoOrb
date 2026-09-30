// Baseline probe: replay the user's game-1 opening, print what the engine
// sees at each AI turn. No test suite, one script, read-only.
import type { CellCoord, GameAction, GameState, WallCoord } from './src/types.js';
import { applyAction, createInitialState } from './src/ruleset.js';
import {
  AI_PROFILES,
  rankActions,
  readTacticalState,
  rivalPressureOnMe,
} from './src/ai.js';
import { readStrategicState } from './src/ai-threat.js';
import { forecastSeal, planDamageAfter } from './src/ai-threat.js';
import { boardOf, routeOf } from './src/ai-structure.js';

const fmt = (a: GameAction): string =>
  a.type === 'MOVE'
    ? `MOVE ${a.to.row},${a.to.col}`
    : a.type === 'PLACE_WALL'
      ? `WALL ${a.wall.row},${a.wall.col},${a.wall.orientation}`
      : a.type;

type Step =
  | { seat: 0 | 1; to: CellCoord }
  | { seat: 0 | 1; wall: WallCoord };

// User's newest game 1. R = seat 0 (bottom, goes up), B = seat 1 (top, goes down).
const OPENING: Step[] = [
  { seat: 0, to: { row: 7, col: 4 } },
  { seat: 1, to: { row: 1, col: 4 } },
  { seat: 0, to: { row: 6, col: 4 } },
  { seat: 1, to: { row: 2, col: 4 } },
  { seat: 0, to: { row: 5, col: 4 } },
  { seat: 1, to: { row: 3, col: 4 } },
  { seat: 0, to: { row: 4, col: 4 } },
  { seat: 1, to: { row: 5, col: 4 } }, // jump over (4,4)
  { seat: 0, wall: { row: 5, col: 3, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, wall: { row: 5, col: 5, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 6 } },
  { seat: 0, wall: { row: 4, col: 6, orientation: 'V' } },
  { seat: 1, to: { row: 4, col: 6 } },
  { seat: 0, to: { row: 3, col: 4 } },
  { seat: 1, to: { row: 3, col: 6 } },
  { seat: 0, wall: { row: 2, col: 6, orientation: 'V' } },
  { seat: 1, to: { row: 3, col: 5 } },
  { seat: 0, to: { row: 2, col: 4 } },
];

function nearestRival(s: GameState, meId: string): number {
  let best = Infinity;
  for (const p of s.players) {
    if (p.id === meId || p.status !== 'ACTIVE') continue;
    const r = routeOf(s, boardOf(s), p);
    if (r.hasGoalAccess && r.distance < best) best = r.distance;
  }
  return best;
}

function main(): void {
  let s = createInitialState({ mode: '2p', gameId: 'probe' });
  console.log(
    'seats:',
    s.players.map((p) => `${p.index}: pos=${p.position.row},${p.position.col} goal=${p.goalDirection}`).join(' | ')
  );
  const aiId = s.players[1].id;
  let ply = 0;
  for (const step of OPENING) {
    const mover = s.players[s.currentPlayerIndex];
    const expected = s.players[step.seat];
    if (mover.id !== expected.id) {
      console.log(`TURN MISMATCH at ply ${ply + 1}: mover=${mover.index} expected=${step.seat}. STOP`);
      return;
    }
    // Snapshot BEFORE the AI moves.
    if (step.seat === 1) {
      const me = s.players[1];
      const board = boardOf(s);
      const myR = routeOf(s, board, me);
      const foeR = routeOf(s, board, s.players[0]);
      const pressure = rivalPressureOnMe(s, aiId);
      const plan = readStrategicState(s, aiId, nearestRival(s, aiId));
      const seal = forecastSeal(s, me, myR.distance, plan, pressure);
      const sealTxt = seal
        ? `seal dmg=${seal.damage} slots=[${seal.slots
            .map((p) => `${Math.floor(p / 16)},${Math.floor(p / 2) % 8},${p % 2 === 1 ? 'V' : 'H'}`)
            .join(' ')}]`
        : 'seal=none';
      const ranked = rankActions(s, aiId, AI_PROFILES.hard, {
        depth: 4,
        deterministic: true,
        tactical: readTacticalState(s, aiId),
        strategic: plan,
        timeBudgetMs: 8000,
      });
      const prevOf = (a: GameAction): string => {
        if (!seal) return '';
        const ap = applyAction(s, a);
        if (!ap.success || ap.state.status !== 'IN_PROGRESS') return '';
        const ma = ap.state.players.find((p) => p.id === aiId);
        if (!ma || ma.status !== 'ACTIVE') return '';
        const b1 = boardOf(ap.state);
        const r1 = routeOf(ap.state, b1, ma);
        if (!r1.hasGoalAccess) return '';
        const v = Math.max(
          0,
          seal.damage - planDamageAfter(b1, ma.goalDirection, ma.position, r1.distance, seal.slots)
        );
        return v > 0 ? ` prev=${v}` : '';
      };
      const top = ranked
        .slice(0, 3)
        .map((r) => `${fmt(r.action)}=${r.score.toFixed(0)}${r.exchange ? '(x)' : ''}${prevOf(r.action)}`)
        .join('  ');
      const walls = ranked.filter((r) => r.action.type === 'PLACE_WALL').length;
      console.log(
        `ply ${String(ply + 1).padStart(2)} me=(${me.position.row},${me.position.col})d${myR.distance}` +
          ` foe d${foeR.distance} pressure=${pressure}` +
          ` bite=${plan.primary?.bite ?? 0}${plan.primary?.structural ? '(struct)' : ''}` +
          ` urgent=${plan.urgent} decided=${plan.raceDecided}` +
          ` ${sealTxt}` +
          ` wallsInList=${walls} | top3: ${top}`
      );
    }
    const action: GameAction =
      'to' in step ? { type: 'MOVE', to: step.to } : { type: 'PLACE_WALL', wall: step.wall };
    const r = applyAction(s, action);
    if (!r.success) {
      console.log(`ILLEGAL at ply ${ply + 1}: ${fmt(action)}. STOP`);
      return;
    }
    s = r.state;
    ply++;
    if (s.status === 'COMPLETED') {
      console.log('game completed early');
      return;
    }
  }
  console.log('opening replayed clean');
}
main();
