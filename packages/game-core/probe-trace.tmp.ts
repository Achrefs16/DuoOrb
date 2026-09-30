// Forward trace: from ply 15, AI marches (new choice) — can it survive?
// Human moves fixed from the real game; AI uses getBestAction(hard) each turn.
import type { CellCoord, GameAction, GameState, WallCoord } from './src/types.js';
import { applyAction, createInitialState } from './src/ruleset.js';
import { AI_PROFILES, getBestAction, productionBudget } from './src/ai.js';

type Step = { seat: 0 | 1; to?: CellCoord; wall?: WallCoord };
// Prefix: real game up to ply 14 (AI to move at 15).
const PREFIX: Step[] = [
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
];
// Human script after ply 15 (their real moves, as coordinates).
const HUMAN: (CellCoord | WallCoord)[] = [
  { row: 1, col: 4 }, // 16 Be2
  { row: 0, col: 1, orientation: 'V' } as WallCoord, // 18 Vb1
  { row: 1, col: 3, orientation: 'H' } as WallCoord, // 20 Hd2
  { row: 1, col: 1, orientation: 'H' } as WallCoord, // 22 Hb2
  { row: 1, col: 3 }, // 24 Bd2
  { row: 5, col: 7, orientation: 'H' } as WallCoord, // 26 Hh6
  { row: 1, col: 2 }, // 28 Bc2
  { row: 0, col: 2 }, // 30 Bc1 wins
];

const fmt = (a: GameAction): string =>
  a.type === 'MOVE'
    ? `MOVE ${a.to.row},${a.to.col}`
    : `WALL ${a.wall.row},${a.wall.col},${a.wall.orientation}`;

function main(): void {
  let s: GameState = createInitialState({ mode: '2p', gameId: 'trace15' });
  for (const step of PREFIX) {
    const a: GameAction =
      step.to !== undefined ? { type: 'MOVE', to: step.to } : { type: 'PLACE_WALL', wall: step.wall as WallCoord };
    const r = applyAction(s, a);
    if (!r.success) {
      console.log('PREFIX ILLEGAL — STOP');
      return;
    }
    s = r.state;
  }
  const aiId = s.players[1].id;
  const budget = productionBudget(AI_PROFILES.hard, '2p');
  let hi = 0;
  for (let turn = 0; turn < 12; turn++) {
    if (s.status !== 'IN_PROGRESS') break;
    const mover = s.players[s.currentPlayerIndex];
    if (mover.id === aiId) {
      const a = getBestAction(s, AI_PROFILES.hard, 4242, budget);
      if (!a) {
        console.log('AI has no move — STOP');
        return;
      }
      console.log(`AI ply ${s.history.length}: ${fmt(a)}`);
      const r = applyAction(s, a);
      if (!r.success) {
        console.log('AI ILLEGAL — STOP');
        return;
      }
      s = r.state;
    } else {
      if (hi >= HUMAN.length) {
        console.log('human script exhausted, status=' + s.status);
        return;
      }
      const h = HUMAN[hi++];
      const a: GameAction =
        (h as WallCoord).orientation !== undefined
          ? { type: 'PLACE_WALL', wall: h as WallCoord }
          : { type: 'MOVE', to: h as CellCoord };
      const r = applyAction(s, a);
      if (!r.success) {
        console.log(`human script illegal at ${fmt(a)} (game diverged) — status=${s.status}`);
        return;
      }
      s = r.state;
    }
    if (s.status === 'COMPLETED') {
      console.log(`COMPLETED after ${s.history.length} plies, winner=${s.winnerId}`);
      return;
    }
  }
  console.log('trace ended, status=' + s.status);
}
main();
