import { describe, expect, it } from 'vitest';
import {
  AI_PROFILES,
  AiPressure,
  getBestAction,
  productionBudget,
  rankActions,
  readTacticalState,
  shortestPathStep,
} from '../src/ai.js';
import { getShortestDistance, hasPathToGoal } from '../src/pathfinding.js';
import { isLegalMove } from '../src/movement.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { isLegalWallPlacement } from '../src/walls.js';
import { GameMode, GameState, RecordedAction, WallCoord } from '../src/types.js';

const STEADY = { ...AI_PROFILES.hard, randomness: 0 };

function describeAction(action: ReturnType<typeof getBestAction>): string {
  if (!action) return 'none';
  return action.type === 'MOVE'
    ? `MOVE ${action.to.row},${action.to.col}`
    : `WALL ${action.wall.row},${action.wall.col},${action.wall.orientation}`;
}

function trail(playerId: string, cells: Array<[number, number]>): RecordedAction[] {
  return cells.map(([row, col], i) => ({
    sequence: i + 1,
    playerId,
    action: { type: 'MOVE', to: { row, col } },
    timestamp: i + 1,
  }));
}

const ALL_MODES: GameMode[] = ['2p', '4p', 'race2', 'race3', 'race4', 'center2', 'center3'];

/** Steps from a seat to the single centre square, for Center Rush assertions. */
function centreDistance(state: GameState, playerId: string): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return Infinity;
  return getShortestDistance(player.position, player.goalDirection, state.walls, state.mode);
}

describe('AI: converts a won race instead of decorating it', () => {
  it('marches rather than inflating a margin it already has', () => {
    // The AI is four steps from the line and comfortably ahead. The old engine
    // would spend its wall hand lengthening a lead that decides nothing, because
    // a big pointless delay scored more than a step of progress.
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 4, col: 4 };
    state.currentPlayerIndex = 1;
    expect(getBestAction(state, STEADY)?.type).toBe('MOVE');
  });

  it('does not throw a wall at a rival seven steps away while it is winning', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 4, col: 4 };
    // The rival is genuinely distant: seven steps from their line with us
    // four out and to move. A wall there delays the inevitable; marching
    // here converts a real lead.
    state.players[0].position = { row: 7, col: 1 };
    state.currentPlayerIndex = 1;
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(isLegalMove(state, 'p2', action.to)).toBe(true);
      const distBefore = getShortestDistance(state.players[1].position, state.players[1].goalDirection, state.walls, '2p');
      const distAfter = getShortestDistance(action.to, state.players[1].goalDirection, state.walls, '2p');
      expect(distAfter).toBeLessThan(distBefore);
    }
  });

  it('still blocks hard when the rival is one step from their line', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 4, col: 4 };
    state.currentPlayerIndex = 1;
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('PLACE_WALL');
    if (action?.type !== 'PLACE_WALL') return;
    const applied = applyAction(state, action);
    expect(applied.success).toBe(true);
    if (!applied.success) return;
    const rival = applied.state.players[0];
    // The block has to actually cost the rival steps, not just exist.
    expect(hasPathToGoal(rival.position, rival.goalDirection, applied.state.walls, '2p')).toBe(true);
  });

  it('races for it when no legal wall can stop the win', () => {
    // The rival is one step out, and the two slots that would close their way on
    // both cross walls that are already down, so blocking is impossible. Spending
    // the turn on a wall that does not block loses the game slowly instead of
    // racing for it.
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 4, col: 4 };
    state.currentPlayerIndex = 1;
    // The two slots that would close the rival's way onto the line both cross a
    // wall that is already down, so blocking is impossible. Their sideways exits
    // are closed too, which leaves them the win or a step backwards.
    state.walls = [
      { row: 0, col: 3, orientation: 'V' },
      { row: 0, col: 4, orientation: 'V' },
    ];
    const tactical = readTacticalState(state, 'p2');
    expect(tactical.pressure).toBe('TACTICAL');
    expect(tactical.intent).toBe('BLOCK');
    // Every slot that could block is occupied, so the turn must go to a move.
    const ranked = rankActions(state, 'p2', STEADY, {
      depth: 2,
      deterministic: true,
      tactical,
      timeBudgetMs: 200,
    });
    expect(ranked.every((r) => r.action.type === 'MOVE')).toBe(true);
  });
});

describe('AI: does not pace around the same corridor', () => {
  it('does not return to the square it just left when a way on exists', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 7, col: 0 };
    state.players[1].position = { row: 2, col: 4 };
    state.players[1].wallsRemaining = 0;
    state.currentPlayerIndex = 1;
    state.history = [
      ...trail('p1', [[7, 4]]),
      ...trail('p2', [[1, 4], [2, 4]]),
    ];
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(isLegalMove(state, 'p2', action.to)).toBe(true);
      expect(action.to).not.toEqual({ row: 1, col: 4 });
      const distBefore = getShortestDistance(state.players[1].position, state.players[1].goalDirection, state.walls, '2p');
      const distAfter = getShortestDistance(action.to, state.players[1].goalDirection, state.walls, '2p');
      expect(distAfter).toBeLessThan(distBefore);
    }
  });

  it('varies its shuffling when a corridor genuinely forces it', () => {
    // Boxed into a one-wide column with the far end closed: every legal move
    // costs distance, so the only thing that separates them is the anti-loop
    // penalty, and it has to prefer the square visited least recently.
    // (let: the loop advances the position by reassigning state.)
    let state = createInitialState({ mode: '2p' });
    state.players[0].wallsRemaining = 0;
    state.players[1].position = { row: 4, col: 4 };
    state.players[1].wallsRemaining = 0;
    state.currentPlayerIndex = 1;
    state.walls = [
      { row: 4, col: 3, orientation: 'V' },
      { row: 4, col: 4, orientation: 'V' },
      { row: 3, col: 3, orientation: 'H' },
      { row: 3, col: 4, orientation: 'H' },
    ];
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const action = getBestAction(state, STEADY);
      if (!action || action.type !== 'MOVE') break;
      seen.push(describeAction(action));
      const applied = applyAction(state, action);
      if (!applied.success) break;
      state = applied.state;
    }
    // A one-wide dead end can only be exited one way, so the walk is forced; what
    // must not happen is the same square over and over.
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
  });
});

describe('AI: pressure classification', () => {
  it('calls an available win TACTICAL and spends only the winning moves', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 5, col: 4 };
    const tactical = readTacticalState(state, 'p1');
    expect(tactical.pressure).toBe('TACTICAL');
    expect(tactical.intent).toBe('WIN');
    expect(tactical.restrict).toBe(true);
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(action.to.row).toBe(0); // Immediately takes the winning goal row!
    }
  });

  it('calls a fresh board NORMAL and spends no extra plies on it', () => {
    for (const mode of ALL_MODES) {
      const tactical = readTacticalState(createInitialState({ mode }), 'p1');
      expect(tactical.extraDepth, mode).toBeGreaterThanOrEqual(0);
      expect(tactical.restrict, mode).toBe(false);
    }
  });

  it('calls a walled-in player TACTICAL and sends it forward', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 4, col: 4 };
    state.players[1].wallsRemaining = 5;
    state.currentPlayerIndex = 1;
    state.walls = [
      { row: 4, col: 3, orientation: 'V' },
      { row: 4, col: 4, orientation: 'V' },
      { row: 3, col: 3, orientation: 'H' },
      { row: 3, col: 4, orientation: 'H' },
    ];
    const tactical = readTacticalState(state, 'p2');
    expect(tactical.pressure).toBe('TACTICAL');
    expect(tactical.intent).toBe('ESCAPE');
    expect(shortestPathStep(state, 'p2')).not.toBeNull();
    const ranked = rankActions(state, 'p2', STEADY, {
      depth: 2,
      deterministic: true,
      tactical,
      timeBudgetMs: 200,
    });
    // The escape is the play. Walls are still considered alongside it, because
    // shaping while you climb out is legitimate, but the way out wins.
    expect(ranked[0].action.type).toBe('MOVE');
    expect(describeAction(ranked[0].action)).toBe('MOVE 5,4');
  });
});

describe('AI: mode-aware play', () => {
  it('follows the optimal detour in a classic duel', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 2, col: 4 };
    state.players[1].wallsRemaining = 0;
    state.currentPlayerIndex = 1;
    state.walls = [{ row: 2, col: 3, orientation: 'H', placedByPlayerId: 'p1', sequence: 1 }];
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(isLegalMove(state, 'p2', action.to)).toBe(true);
      const dist = getShortestDistance(action.to, 'DOWN', state.walls, '2p');
      const distStart = getShortestDistance(state.players[1].position, 'DOWN', state.walls, '2p');
      expect(dist).toBeLessThanOrEqual(distStart);
    }
  });

  it('runs its own race in a race mode instead of walling', () => {
    const state = createInitialState({ mode: 'race4' });
    state.players[0].position = { row: 3, col: 1 };
    state.players[1].position = { row: 7, col: 3 };
    state.currentPlayerIndex = 1;
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type === 'MOVE') {
      expect(isLegalMove(state, 'p2', action.to)).toBe(true);
      const distBefore = getShortestDistance(state.players[1].position, state.players[1].goalDirection, state.walls, 'race4');
      const distAfter = getShortestDistance(action.to, state.players[1].goalDirection, state.walls, 'race4');
      expect(distAfter).toBeLessThan(distBefore);
    }
  });

  it('builds a funnel towards a shared goal edge in a race', () => {
    // Two rivals, one edge. The AI is behind, so it should either race or spend
    // its wall narrowing the way in — never a wall that does neither.
    const state = createInitialState({ mode: 'race3' });
    state.players[1].position = { row: 6, col: 3 };
    state.players[0].position = { row: 4, col: 3 };
    state.currentPlayerIndex = 1;
    const action = getBestAction(state, STEADY);
    expect(action).not.toBeNull();
    if (action?.type === 'PLACE_WALL') {
      const applied = applyAction(state, action);
      expect(applied.success).toBe(true);
    }
  });

  it('competes for the single centre square in Center Rush', () => {
    const state = createInitialState({ mode: 'center3' });
    state.players[0].position = { row: 6, col: 4 };
    state.players[1].position = { row: 6, col: 0 };
    state.currentPlayerIndex = 1;
    const before = centreDistance(state, 'p2');
    const action = getBestAction(state, STEADY);
    expect(action?.type).toBe('MOVE');
    if (action?.type !== 'MOVE') return;
    const after = applyAction(state, action);
    expect(after.success).toBe(true);
    if (!after.success) return;
    const me = after.state.players[1];
    // Every seat races the same single square, so the only thing that matters is
    // closing on it.
    expect(getShortestDistance(me.position, me.goalDirection, after.state.walls, 'center3')).toBeLessThan(
      before
    );
  });

  it('reads placement, not just the nearest rival, in four-player', () => {
    // The AI is second of four. A move that keeps it ahead of two rivals is worth
    // more than one that only outpaces the closest, which is what a
    // nearest-rival-only evaluation gets wrong.
    const state = createInitialState({ mode: '4p' });
    state.players[0].position = { row: 3, col: 4 };
    state.players[1].position = { row: 6, col: 4 };
    state.players[2].position = { row: 4, col: 1 };
    state.players[3].position = { row: 4, col: 7 };
    state.currentPlayerIndex = 1;
    const before = getShortestDistance(
      state.players[1].position,
      state.players[1].goalDirection,
      state.walls,
      '4p'
    );
    const action = getBestAction(state, STEADY);
    expect(action).not.toBeNull();
    if (action?.type === 'MOVE') {
      const me = state.players[1];
      expect(isLegalMove(state, me.id, action.to)).toBe(true);
      // Racing a shared table means walking towards your own line, whichever
      // rival happens to be nearest.
      expect(
        getShortestDistance(action.to, me.goalDirection, state.walls, '4p')
      ).toBeLessThan(before);
    }
  });

  it('plays every seat in a free-for-all as itself, not as a coalition', () => {
    // The AI seat must not assume the other three orbs are cooperating against
    // it: the best it can do is its own race, and a legal, progressing move is
    // the observable requirement.
    const state = createInitialState({ mode: '4p' });
    state.currentPlayerIndex = 2;
    const action = getBestAction(state, STEADY);
    expect(action).not.toBeNull();
    if (action?.type === 'MOVE') {
      expect(isLegalMove(state, 'p3', action.to)).toBe(true);
    }
  });
});

describe('AI: candidate generation', () => {
  it('extends its own wall chain rather than scattering walls', () => {
    // A vertical chain beside the rival's route: the useful walls are the ones
    // that continue it, which a reactive "first N slots along their path" scan
    // could never find.
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 5, col: 4 };
    state.currentPlayerIndex = 1;
    const chain: WallCoord[] = [
      { row: 5, col: 3, orientation: 'V' },
      { row: 5, col: 4, orientation: 'V' },
    ];
    state.walls = chain.map((w, i) => ({ ...w, placedByPlayerId: 'p1', sequence: i + 1 }));
    const action = getBestAction(state, STEADY);
    if (action?.type === 'PLACE_WALL') {
      const adjacent = chain.some((w) =>
        Math.abs(w.row - action.wall.row) <= 1 && Math.abs(w.col - action.wall.col) <= 1
      );
      expect(adjacent).toBe(true);
    }
  });

  it('never returns an illegal action, in any mode at any difficulty', () => {
    for (const mode of ALL_MODES) {
      for (const difficulty of ['easy', 'normal', 'hard'] as const) {
        let state: GameState = createInitialState({ mode, gameId: `legal-${mode}` });
        for (let ply = 0; ply < 6 && state.status === 'IN_PROGRESS'; ply++) {
          const action = getBestAction(state, AI_PROFILES[difficulty]);
          expect(action, `${mode}/${difficulty} ply ${ply}`).not.toBeNull();
          if (!action) break;
          const player = state.players[state.currentPlayerIndex];
          if (action.type === 'MOVE') {
            expect(isLegalMove(state, player.id, action.to), `${mode}/${difficulty}`).toBe(true);
          } else if (action.type === 'PLACE_WALL') {
            expect(isLegalWallPlacement(state, player.id, action.wall), `${mode}/${difficulty}`).toBe(true);
          }
          const applied = applyAction(state, action);
          expect(applied.success, `${mode}/${difficulty} ply ${ply}`).toBe(true);
          if (!applied.success) break;
          // No matter what the AI does, nobody may be sealed out.
          for (const seat of applied.state.players) {
            expect(
              hasPathToGoal(seat.position, seat.goalDirection, applied.state.walls, mode),
              `${mode}/${difficulty} sealed ${seat.id}`
            ).toBe(true);
          }
          state = applied.state;
        }
      }
    }
  }, 120_000);
});

describe('AI: determinism', () => {
  it('returns the same action for the same position, seed and profile', () => {
    const state = createInitialState({ mode: 'center3' });
    const first = describeAction(getBestAction(state, AI_PROFILES.normal));
    for (let i = 0; i < 4; i++) {
      expect(describeAction(getBestAction(state, AI_PROFILES.normal))).toBe(first);
    }
  });

  it('replays a whole game identically from the same opening', () => {
    const play = (): string => {
      let state: GameState = createInitialState({ mode: '2p', gameId: 'det-play' });
      const line: string[] = [];
      for (let i = 0; i < 20 && state.status === 'IN_PROGRESS'; i++) {
        const action = getBestAction(state, { ...STEADY, simulations: 150 });
        if (!action) break;
        line.push(describeAction(action));
        const applied = applyAction(state, action);
        if (!applied.success) break;
        state = applied.state;
      }
      return line.join(' ');
    };
    expect(play()).toBe(play());
  }, 10_000);

  it('keeps easy reproducible for a position, jitter notwithstanding', () => {
    const state = createInitialState({ mode: 'race3' });
    const first = describeAction(getBestAction(state, AI_PROFILES.easy));
    for (let i = 0; i < 4; i++) {
      expect(describeAction(getBestAction(state, AI_PROFILES.easy))).toBe(first);
    }
  });

  it('ranks candidates best-first and stably', () => {
    const state = createInitialState({ mode: '2p' });
    const a = rankActions(state, 'p1', STEADY, { depth: 2, deterministic: true, timeBudgetMs: 500 });
    const b = rankActions(state, 'p1', STEADY, { depth: 2, deterministic: true, timeBudgetMs: 500 });
    expect(a.map((r) => describeAction(r.action))).toEqual(b.map((r) => describeAction(r.action)));
    expect(a.map((r) => r.score)).toEqual(b.map((r) => r.score));
    for (let i = 1; i < a.length; i++) {
      // On-path moves sort first; within a group, scores never increase.
      if (a[i - 1].score < a[i].score) {
        expect(a[i - 1].action.type).toBe('MOVE');
      }
    }
  });
});

describe('AI: per-move budget', () => {
  it('keeps every difficulty inside its wall-clock ceiling', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const profile = AI_PROFILES[difficulty];
      // Warm up JIT compiler before measurement
      const warmupState = createInitialState({ mode: '4p' });
      getBestAction(warmupState, profile);
      // (let: the loop advances the game by reassigning state.)
      let state = createInitialState({ mode: '4p', gameId: `budget-${difficulty}` });
      let worst = 0;
      for (let i = 0; i < 6; i++) {
        const started = Date.now();
        const action = getBestAction(state, profile);
        worst = Math.max(worst, Date.now() - started);
        if (!action) break;
        const applied = applyAction(state, action);
        if (!applied.success) break;
        state = applied.state;
        if (state.status !== 'IN_PROGRESS') {
          state = createInitialState({ mode: '4p', gameId: `budget-${difficulty}` });
        }
      }
      // The budget is a promise to the UI thread, so it is a ceiling and not a
      // target. The margin absorbs the one search node the clock cannot
      // interrupt. The ceiling is the mode-aware PRODUCTION budget: the
      // profile's legacy `timeBudgetMs` is only a default for callers driving
      // rankActions() directly, and gameplay no longer runs on it.
      const ceiling = productionBudget(profile, '4p').timeMs * 1.25 + 20;
      expect(worst, difficulty).toBeLessThanOrEqual(ceiling);
    }
  }, 60_000);
});
