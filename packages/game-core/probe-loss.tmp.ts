// Probe the user's 31-ply loss. B=seat0 human (bottom, up), R=seat1 AI (top, down).
import type { CellCoord, GameAction, GameState, WallCoord } from './src/types.js';
import { applyAction, createInitialState } from './src/ruleset.js';
import {
  AI_PROFILES,
  rankActions,
  readTacticalState,
  rivalPressureOnMe,
} from './src/ai.js';
import { forecastSeal, planDamageAfter, readStrategicState } from './src/ai-threat.js';
import { boardOf, routeOf } from './src/ai-structure.js';

const fmt = (a: GameAction): string =>
  a.type === 'MOVE'
    ? `MOVE ${a.to.row},${a.to.col}`
    : a.type === 'PLACE_WALL'
      ? `WALL ${a.wall.row},${a.wall.col},${a.wall.orientation}`
      : a.type;

type Step = { seat: 0 | 1; to?: CellCoord; wall?: WallCoord };
const G: Step[] = [
  { seat: 0, to: { row: 7, col: 4 } },
  { seat: 1, to: { row: 1, col: 4 } },
  { seat: 0, to: { row: 6, col: 4 } },
  { seat: 1, to: { row: 2, col: 4 } },
  { seat: 0, to: { row: 5, col: 4 } },
  { seat: 1, to: { row: 3, col: 4 } },
  { seat: 0, to: { row: 4, col: 4 } },
  { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, wall: { row: 5, col: 3, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, wall: { row: 5, col: 5, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, to: { row: 3, col: 4 } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, to: { row: 2, col: 4 } },
  { seat: 1, wall: { row: 0, col: 3, orientation: 'H' } },
  { seat: 0, to: { row: 1, col: 4 } },
  { seat: 1, wall: { row: 0, col: 4, orientation: 'V' } },
  { seat: 0, wall: { row: 0, col: 1, orientation: 'V' } },
  { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, wall: { row: 1, col: 3, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, wall: { row: 1, col: 1, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 6 } },
  { seat: 0, to: { row: 1, col: 3 } },
  { seat: 1, to: { row: 5, col: 7 } },
  { seat: 0, wall: { row: 5, col: 7, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 6 } },
  { seat: 0, to: { row: 1, col: 2 } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, to: { row: 0, col: 2 } },
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
  let s = createInitialState({ mode: '2p', gameId: 'loss31' });
  const aiId = s.players[1].id;
  let ply = 0;
  for (const step of G) {
    const mover = s.players[s.currentPlayerIndex];
    if (mover.id !== s.players[step.seat].id) {
      console.log(`TURN MISMATCH at ply ${ply}. STOP`);
      return;
    }
    if (step.seat === 1 && s.status === 'IN_PROGRESS') {
      const me = s.players[1];
      const board = boardOf(s);
      const myR = routeOf(s, board, me);
      const foeR = routeOf(s, board, s.players[0]);
      const pressure = rivalPressureOnMe(s, aiId);
      const plan = readStrategicState(s, aiId, nearestRival(s, aiId));
      const tactical = readTacticalState(s, aiId);
      const seal = forecastSeal(s, me, myR.distance, plan, pressure);
      const ranked = rankActions(s, aiId, AI_PROFILES.hard, {
        depth: 4,
        deterministic: true,
        tactical,
        strategic: plan,
        timeBudgetMs: 8000,
      });
      const top = ranked
        .slice(0, 4)
        .map((r) => `${fmt(r.action)}=${r.score.toFixed(0)}${r.exchange ? '(x)' : ''}`)
        .join('  ');
      const played = G[ply];
      const playedTxt =
        step.seat === 1
          ? fmt(
              'to' in played && played.to
                ? { type: 'MOVE', to: played.to }
                : { type: 'PLACE_WALL', wall: (played as { wall: WallCoord }).wall }
            )
          : '';
      console.log(
        `ply ${String(ply).padStart(2)} me=(${me.position.row},${me.position.col})d${myR.distance}` +
          ` foe d${foeR.distance} pressure=${pressure} bite=${plan.primary?.bite ?? 0}` +
          `${plan.primary?.structural ? '(struct)' : ''} urgent=${plan.urgent}` +
          ` intent=${tactical.intent} seal=${seal ? `dmg${seal.damage}` : 'none'}` +
          ` | top4: ${top}  || played: ${playedTxt}`
      );
    }
    const action: GameAction =
      step.to !== undefined ? { type: 'MOVE', to: step.to } : { type: 'PLACE_WALL', wall: step.wall as WallCoord };
    const r = applyAction(s, action);
    if (!r.success) {
      console.log(`ILLEGAL at ply ${ply}: ${fmt(action)}. STOP`);
      return;
    }
    s = r.state;
    ply++;
    if (s.status === 'COMPLETED') {
      console.log(`game completed after ply ${ply - 1}, winner=${s.winnerId}`);
      return;
    }
  }
  console.log('replayed clean, status=' + s.status);
  void planDamageAfter;
}
main();
