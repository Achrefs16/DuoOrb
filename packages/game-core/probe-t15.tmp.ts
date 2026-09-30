// Single-position full-strength check at game-B ply 15.
import type { CellCoord, GameAction, GameState, WallCoord } from './src/types.js';
import { applyAction, createInitialState } from './src/ruleset.js';
import { AI_PROFILES, getBestAction, productionBudget, searchStats } from './src/ai.js';

type Step = { seat: 0 | 1; to?: CellCoord; wall?: WallCoord };
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
];
const fmt = (a: GameAction | null): string =>
  !a ? 'none' : a.type === 'MOVE' ? `MOVE ${a.to.row},${a.to.col}` : `WALL ${a.wall.row},${a.wall.col},${a.wall.orientation}`;

function main(): void {
  let s: GameState = createInitialState({ mode: '2p', gameId: 't15' });
  for (const step of G) {
    const a: GameAction =
      step.to !== undefined ? { type: 'MOVE', to: step.to } : { type: 'PLACE_WALL', wall: step.wall as WallCoord };
    s = applyAction(s, a).state;
  }
  const t0 = Date.now();
  const a = getBestAction(s, AI_PROFILES.hard, 4242, productionBudget(AI_PROFILES.hard, '2p'));
  const st = searchStats();
  console.log(`ply15 full-strength: ${fmt(a)}  depth=${st.depthReached} nodes=${st.nodes} ${Date.now() - t0}ms`);
}
main();
