import { describe, expect, it } from 'vitest';
import {
  applyAction,
  botById,
  createInitialState,
  getBestAction,
  getBestActionAsync,
  getLegalMoves,
  getShortestDistance,
} from '../src/index.js';
import type { GameAction, GameState } from '../src/types.js';

function describeAction(action: GameAction): string {
  if (action.type === 'MOVE') return `M${action.to.row},${action.to.col}`;
  return `W${action.wall.row},${action.wall.col}${action.wall.orientation}`;
}

/**
 * Live async play gets a fresh entropy seed on every turn. Five games against
 * the same beginner must therefore diverge instead of replaying one script.
 */
describe('AI live variety', () => {
  it('produces at least three different move sequences in five games', async () => {
    const martin = botById('martin');
    expect(martin).not.toBeNull();

    const play = async (): Promise<string> => {
      let state: GameState = createInitialState({ mode: '2p', gameId: 'variety' });
      const line: string[] = [];
      for (let ply = 0; ply < 5 && state.status === 'IN_PROGRESS'; ply++) {
        const action = await getBestActionAsync(state, martin!.profile);
        if (!action) break;
        line.push(describeAction(action));
        const applied = applyAction(state, action);
        if (!applied.success) break;
        state = applied.state;
      }
      return line.join(' ');
    };

    const games: string[] = [];
    for (let i = 0; i < 5; i++) games.push(await play());
    expect(new Set(games).size).toBeGreaterThanOrEqual(3);
  }, 20_000);

  it('Martin loses most games to plain shortest-path play', () => {
    const martin = botById('martin');
    expect(martin).not.toBeNull();

    const shortestStep = (state: GameState): GameAction | null => {
      const mover = state.players[state.currentPlayerIndex];
      let best: { row: number; col: number } | null = null;
      let bestDist = Infinity;
      for (const to of getLegalMoves(state, mover.id)) {
        const dist = getShortestDistance(
          to,
          mover.goalDirection,
          state.walls,
          state.mode
        );
        if (
          dist < bestDist ||
          (dist === bestDist &&
            best &&
            (to.row < best.row || (to.row === best.row && to.col < best.col)))
        ) {
          best = to;
          bestDist = dist;
        }
      }
      return best ? { type: 'MOVE', to: best } : null;
    };

    let shortestWins = 0;
    for (let game = 0; game < 5; game++) {
      let state = createInitialState({ mode: '2p', gameId: `easy-gap-${game}` });
      for (let ply = 0; ply < 80 && state.status === 'IN_PROGRESS'; ply++) {
        const action =
          state.currentPlayerIndex === 0
            ? getBestAction(state, martin!.profile, 100 + game * 97 + ply)
            : shortestStep(state);
        if (!action) break;
        const applied = applyAction(state, action);
        if (!applied.success) break;
        state = applied.state;
      }
      if (state.winnerId === state.players[1].id) shortestWins += 1;
    }
    expect(shortestWins).toBeGreaterThanOrEqual(3);
  }, 20_000);
});

describe('master difficulty', () => {
  const masters = ['viktor', 'achref'] as const;

  it('converts a one-step win immediately', () => {
    for (const id of masters) {
      const bot = botById(id);
      expect(bot).not.toBeNull();
      const base = createInitialState({ mode: '2p', gameId: `master-win-${id}` });
      const state: GameState = {
        ...base,
        players: base.players.map((p, i) => ({
          ...p,
          position: i === 0 ? { row: 1, col: 4 } : { row: 7, col: 4 },
        })),
        currentPlayerIndex: 0,
      };
      const action = getBestAction(state, bot!.profile, 11);
      expect(action).toEqual({ type: 'MOVE', to: { row: 0, col: 4 } });
    }
  }, 20_000);

  it('blocks a rival that is one step from goal', () => {
    for (const id of masters) {
      const bot = botById(id);
      expect(bot).not.toBeNull();
      const base = createInitialState({ mode: '2p', gameId: `master-block-${id}` });
      const state: GameState = {
        ...base,
        players: base.players.map((p, i) => ({
          ...p,
          position: i === 0 ? { row: 4, col: 4 } : { row: 7, col: 4 },
          wallsRemaining: 5,
        })),
        currentPlayerIndex: 0,
      };
      const action = getBestAction(state, bot!.profile, 23, {
        timeMs: 500,
        maxDepth: 4,
      });
      expect(action?.type).toBe('PLACE_WALL');
      if (action?.type !== 'PLACE_WALL') continue;
      const applied = applyAction(state, action);
      expect(applied.success).toBe(true);
      if (!applied.success) continue;
      const rival = applied.state.players[1];
      expect(
        getShortestDistance(rival.position, rival.goalDirection, applied.state.walls, state.mode)
      ).toBeGreaterThan(1);
    }
  }, 30_000);
});
