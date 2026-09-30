// Before/after lens for the inner lane-anchor change on game-B positions.
import type { CellCoord, GameAction, GameState, WallCoord } from './src/types.js';
import { applyAction, createInitialState } from './src/ruleset.js';
import { AI_PROFILES, rankActions, readTacticalState, rivalPressureOnMe } from './src/ai.js';
import { forecastSeal, readStrategicState } from './src/ai-threat.js';
import { boardOf, routeOf } from './src/ai-structure.js';

const fmt = (a: GameAction): string =>
  a.type === 'MOVE' ? `MOVE ${a.to.row},${a.to.col}` : `WALL ${a.wall.row},${a.wall.col},${a.wall.orientation}`;

type Step = { seat: 0 | 1; to?: CellCoord; wall?: WallCoord };
// Game B prefix through ply 14 (AI to move at 15).
const G: Step[] = [
  { seat: 0, to: { row: 7, col: 4 } }, { seat: 1, to: { row: 1, col: 4 } },
  { seat: 0, to: { row: 6, col: 4 } }, { seat: 1, to: { row: 2, col: 4 } },
  { seat: 0, to: { row: 5, col: 4 } }, { seat: 1, to: { row: 3, col: 4 } },
  { seat: 0, to: { row: 4, col: 4 } }, { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, wall: { row: 5, col: 3, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, wall: { row: 5, col: 5, orientation: 'H' } },
  { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, to: { row: 3, col: 4 } },
  { seat: 1, to: { row: 5, col: 5 } },
  { seat: 0, to: { row: 2, col: 4 } },
  // Dummy continuations: snapshots at 15/17 are taken BEFORE applying these.
  { seat: 1, to: { row: 5, col: 4 } },
  { seat: 0, to: { row: 1, col: 4 } },
  { seat: 1, to: { row: 5, col: 5 } },
];

function main(): void {
  let s: GameState = createInitialState({ mode: '2p', gameId: 'lane' });
  const aiId = s.players[1].id;
  let ply = 0;
  for (const step of G) {
    if (step.seat === 1 && s.status === 'IN_PROGRESS') {
      const me = s.players[1];
      const board = boardOf(s);
      const myR = routeOf(s, board, me);
      const foeR = routeOf(s, board, s.players[0]);
      let near = Infinity;
      for (const p of s.players) {
        if (p.id === aiId || p.status !== 'ACTIVE') continue;
        const r = routeOf(s, boardOf(s), p);
        if (r.hasGoalAccess && r.distance < near) near = r.distance;
      }
      const pressure = rivalPressureOnMe(s, aiId);
      const plan = readStrategicState(s, aiId, near);
      const t0 = Date.now();
      const ranked = rankActions(s, aiId, AI_PROFILES.hard, {
        depth: 4,
        deterministic: true,
        tactical: readTacticalState(s, aiId),
        strategic: plan,
        timeBudgetMs: 8000,
      });
      const ms = Date.now() - t0;
      const seal = forecastSeal(s, me, myR.distance, plan, pressure);
      console.log(
        `ply ${ply} me d${myR.distance} foe d${foeR.distance} urgent=${plan.urgent}` +
          ` seal=${seal ? `dmg${seal.damage}[${seal.slots.join(',')}]` : 'none'} ${ms}ms | ` +
          ranked
            .slice(0, 4)
            .map((r) => `${fmt(r.action)}=${r.score.toFixed(0)}${r.exchange ? '(x)' : ''}`)
            .join('  ')
      );
    }
    const a: GameAction =
      step.to !== undefined ? { type: 'MOVE', to: step.to } : { type: 'PLACE_WALL', wall: step.wall as WallCoord };
    const r = applyAction(s, a);
    if (!r.success) {
      console.log('ILLEGAL — STOP');
      return;
    }
    s = r.state;
    ply++;
  }
}
main();
