/**
 * Why does the engine wall so rarely? Replays the user's pasted loss ply by
 * ply and, at every ply the AI controlled, prints what the engine WOULD have
 * played next to what was actually played, plus the score gap between the best
 * wall and the best move. Read-only: no engine changes.
 */
import { parseGame, formatAction } from './src/notation.js';
import { createInitialState, applyAction } from './src/ruleset.js';
import { getBestAction, rankActions, AI_PROFILES } from './src/ai.js';
import type { GameState } from './src/types.js';

const GAME = `0. Be8
1. Re2
2. Be7
3. Re3
4. Be6
5. Re4
6. Be5
7. Re6
8. He6
9. Rd6
10. Hc6
11. Rc6
12. Be4
13. Rb6
14. Ha6
15. Rc6
16. Be3
17. Rd6
18. Be2
19. Hd1
20. Vf1
21. Re6
22. Bf2
23. Rf6
24. Bf1`;

const moves = parseGame(GAME);
const profile = AI_PROFILES.hard;

let state: GameState = createInitialState({ mode: '2p' });
let aiPlies = 0;
let engineWalls = 0;
let humanWalls = 0;
let engineMoves = 0;

for (let i = 0; i < moves.length; i++) {
  if (state.status !== 'IN_PROGRESS') break;
  const mover = state.players[state.currentPlayerIndex];
  if (!mover) break;
  const isHuman = mover.index === 0;
  const played = moves[i];

  let note = '';
  if (!isHuman) {
    aiPlies++;
    const action = getBestAction(state, profile, 12345);
    const ranked = rankActions(state, mover.id, profile, { deterministic: true });
    const walls = ranked.filter((r) => r.action.type === 'PLACE_WALL');
    const movesOnly = ranked.filter((r) => r.action.type === 'MOVE');
    const bestWall = walls[0];
    const bestMove = movesOnly[0];
    if (action?.type === 'PLACE_WALL') engineWalls++;
    if (action?.type === 'MOVE') engineMoves++;
    const gap = bestWall && bestMove ? (bestWall.score - bestMove.score).toFixed(1) : 'n/a';
    note =
      ` | engine=${action ? formatAction(action, mover.index) : '-'}` +
      ` | bestMove=${bestMove ? formatAction(bestMove.action, mover.index) : '-'}(${bestMove?.score.toFixed(1)})` +
      ` | bestWall=${bestWall ? formatAction(bestWall.action, mover.index) : '-'}(${bestWall?.score.toFixed(1)})` +
      ` | gap=${gap} | nWallCand=${walls.length}`;
  } else {
    const d = mover.position;
    const opp = state.players[1];
    note =
      ` | human: me d=${d.row},${d.col} walls=${mover.wallsRemaining}` +
      ` | foe d=${opp.position.row},${opp.position.col} walls=${opp.wallsRemaining}`;
    if (played.action.type === 'PLACE_WALL') humanWalls++;
  }

  const res = applyAction(state, played.action);
  if (!res.success) {
    console.log(`ply ${i}: FAILED ${played.token} -> ${res.error}`);
    break;
  }
  state = res.state;
  console.log(`ply ${String(i).padStart(2)} ${mover.index === 0 ? 'B' : 'R'} played ${played.token}${note}`);
}

console.log(`\nAI plies: ${aiPlies} | engine would wall: ${engineWalls} | engine would move: ${engineMoves}`);
console.log(`human walls played: ${humanWalls}`);
console.log(`final status: ${state.status}`);
