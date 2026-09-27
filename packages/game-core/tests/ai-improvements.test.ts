import { describe, expect, it } from 'vitest';
import {
  AI_PROFILES,
  evaluateState,
  getBestAction,
  getCandidateActions,
  rankActions,
  searchStats,
} from '../src/ai.js';
import { getLegalMoves } from '../src/movement.js';
import { getShortestDistance } from '../src/pathfinding.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { isLegalWallPlacement } from '../src/walls.js';
import type {
  GameMode,
  GameState,
  GoalDirection,
  PlayerState,
  RecordedAction,
  Wall,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// State builder (AI-only tests: well-formed states, real rules for applyAction)
// ---------------------------------------------------------------------------

let wallSeq = 0;
function wall(row: number, col: number, orientation: 'H' | 'V', by = 'p1'): Wall {
  return { row, col, orientation, placedByPlayerId: by, sequence: ++wallSeq };
}

function player(
  index: number,
  row: number,
  col: number,
  goalDirection: GoalDirection,
  wallsRemaining: number
): PlayerState {
  return {
    id: `p${index + 1}`,
    index,
    displayName: `P${index + 1}`,
    position: { row, col },
    wallsRemaining,
    goalDirection,
    status: 'ACTIVE',
    place: null,
  };
}

function freshBase(mode: GameMode): GameState {
  try {
    const s = createInitialState({ mode } as any);
    if (s && Array.isArray(s.players)) return s;
  } catch {
    /* fall through to the literal */
  }
  return {
    rulesetVersion: 'test',
    gameId: 'ai-test',
    mode,
    status: 'IN_PROGRESS',
    players: [],
    walls: [],
    currentPlayerIndex: 0,
    moveNumber: 1,
    lastMove: null,
    winnerId: null,
    history: [],
    createdAt: 0,
    startedAt: 0,
    endedAt: null,
    placements: [],
  };
}

function makeState(
  mode: GameMode,
  players: PlayerState[],
  walls: Wall[] = [],
  currentPlayerIndex = 0,
  history: RecordedAction[] = []
): GameState {
  return {
    ...freshBase(mode),
    mode,
    status: 'IN_PROGRESS',
    players,
    walls,
    currentPlayerIndex,
    moveNumber: history.length + 1,
    lastMove: history[history.length - 1] ?? null,
    winnerId: null,
    history,
    placements: [],
  };
}

function moveRecord(seq: number, playerId: string, row: number, col: number): RecordedAction {
  return { sequence: seq, playerId, action: { type: 'MOVE', to: { row, col } }, timestamp: seq };
}

// ---------------------------------------------------------------------------
// 1. Conversion beats decoration
// ---------------------------------------------------------------------------

describe('conversion beats decoration', () => {
  it('takes the immediate winning step, even with pretty walls available', () => {
    const state = makeState('2p', [player(0, 1, 4, 'TOP', 6), player(1, 5, 4, 'BOTTOM', 8)], [
      wall(3, 2, 'H'),
      wall(3, 4, 'H'), // a chain begging to be extended
    ]);
    expect(getBestAction(state, AI_PROFILES.hard)).toEqual({ type: 'MOVE', to: { row: 0, col: 4 } });
  });

  it('marches when ahead instead of inflating the margin', () => {
    // p1 distance 5, p2 distance 6, p1 holds walls and a delaying wall exists.
    const state = makeState('2p', [player(0, 5, 4, 'TOP', 8), player(1, 2, 6, 'BOTTOM', 8)]);
    const action = getBestAction(state, AI_PROFILES.hard);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('MOVE');
    if (action!.type === 'MOVE') expect(action!.to).toEqual({ row: 4, col: 4 });
  });

  it('does not throw walls at a distant rival while winning', () => {
    const state = makeState('2p', [player(0, 4, 4, 'TOP', 8), player(1, 1, 7, 'BOTTOM', 8)], [
      wall(6, 6, 'V'),
      wall(3, 2, 'H'),
    ]);
    const action = getBestAction(state, AI_PROFILES.hard);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('MOVE');
    if (action!.type === 'MOVE') expect(action!.to.row).toBe(3);
  });

  it('rankActions puts the winning move first with a decisive score', () => {
    const state = makeState('2p', [player(0, 1, 4, 'TOP', 6), player(1, 6, 4, 'BOTTOM', 6)]);
    const ranked = rankActions(state, 'p1', AI_PROFILES.hard, { deterministic: true });
    expect(ranked[0].action).toEqual({ type: 'MOVE', to: { row: 0, col: 4 } });
    expect(ranked[0].score).toBeGreaterThan(5000);
  });
});

// ---------------------------------------------------------------------------
// 2. Evaluation: absolute progress and linear lead
// ---------------------------------------------------------------------------

describe('evaluation', () => {
  const hard = AI_PROFILES.hard;

  it('scores a closer position higher at the same lead (absolute progress)', () => {
    const closer = makeState('2p', [player(0, 4, 4, 'TOP', 10), player(1, 2, 4, 'BOTTOM', 10)]);
    const further = makeState('2p', [player(0, 5, 4, 'TOP', 10), player(1, 1, 4, 'BOTTOM', 10)]);
    // Lead is +2 in both. "Both sides advance" must not score 0.
    expect(evaluateState(closer, 'p1', hard)).toBeGreaterThan(evaluateState(further, 'p1', hard));
  });

  it('scores a bigger lead higher at the same own distance (linear lead)', () => {
    const ahead = makeState('2p', [player(0, 4, 4, 'TOP', 10), player(1, 2, 4, 'BOTTOM', 10)]);
    const level = makeState('2p', [player(0, 4, 4, 'TOP', 10), player(1, 4, 6, 'BOTTOM', 10)]);
    expect(evaluateState(ahead, 'p1', hard)).toBeGreaterThan(evaluateState(level, 'p1', hard));
  });

  it('is deterministic per position', () => {
    const state = makeState('2p', [player(0, 5, 4, 'TOP', 8), player(1, 2, 6, 'BOTTOM', 8)]);
    expect(getBestAction(state, AI_PROFILES.hard, 42)).toEqual(
      getBestAction(state, AI_PROFILES.hard, 42)
    );
    const r1 = rankActions(state, 'p1', AI_PROFILES.hard, { deterministic: true, depth: 2 });
    const r2 = rankActions(state, 'p1', AI_PROFILES.hard, { deterministic: true, depth: 2 });
    expect(r1.map((r) => r.action)).toEqual(r2.map((r) => r.action));
  });
});

// ---------------------------------------------------------------------------
// 3. Emergency blocking still works
// ---------------------------------------------------------------------------

describe('blocking', () => {
  it('blocks a rival one step from the line, and the block actually delays', () => {
    const state = makeState('2p', [player(0, 4, 4, 'TOP', 10), player(1, 7, 4, 'BOTTOM', 10)]);
    const action = getBestAction(state, AI_PROFILES.hard);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('PLACE_WALL');
    const applied = applyAction(state, action!);
    expect(applied.success).toBe(true);
    if (applied.success) {
      const dist = getShortestDistance({ row: 7, col: 4 }, 'BOTTOM', applied.state.walls, '2p');
      expect(dist).toBeGreaterThan(1);
    }
  });

  it('races instead of throwing a useless wall when no block exists', () => {
    // Rival one step out, but p1 has no walls: the turn is spent moving.
    const state = makeState('2p', [player(0, 4, 4, 'TOP', 0), player(1, 7, 4, 'BOTTOM', 10)]);
    const action = getBestAction(state, AI_PROFILES.hard);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('MOVE');
  });
});

// ---------------------------------------------------------------------------
// 4. No corridor pacing
// ---------------------------------------------------------------------------

describe('corridor discipline', () => {
  it('walks the corridor forward instead of bouncing', () => {
    // Column 4 walled off on both sides at rows 5-6: only up/down are open.
    const walls = [wall(5, 3, 'V'), wall(5, 4, 'V')];
    // History shows p1 has already bounced (6,4)->(5,4)->(6,4).
    const history = [
      moveRecord(1, 'p1', 5, 4),
      moveRecord(2, 'p2', 3, 0),
      moveRecord(3, 'p1', 6, 4),
      moveRecord(4, 'p2', 4, 0),
    ];
    const state = makeState(
      '2p',
      [player(0, 6, 4, 'TOP', 10), player(1, 4, 0, 'BOTTOM', 10)],
      walls,
      0,
      history
    );
    const action = getBestAction(state, AI_PROFILES.hard);
    expect(action).toEqual({ type: 'MOVE', to: { row: 5, col: 4 } });

    const ranked = rankActions(state, 'p1', AI_PROFILES.hard, { deterministic: true });
    const forward = ranked.find(
      (r) => r.action.type === 'MOVE' && r.action.to.row === 5 && r.action.to.col === 4
    );
    const backward = ranked.find(
      (r) => r.action.type === 'MOVE' && r.action.to.row === 7 && r.action.to.col === 4
    );
    expect(forward).toBeDefined();
    expect(backward).toBeDefined();
    expect(forward!.score).toBeGreaterThan(backward!.score);
  });
});

// ---------------------------------------------------------------------------
// 5. Per-move budget and honest stats
// ---------------------------------------------------------------------------

describe('budget', () => {
  function midGame(): GameState {
    return makeState(
      '2p',
      [player(0, 6, 4, 'TOP', 7), player(1, 2, 4, 'BOTTOM', 7)],
      [wall(2, 2, 'H'), wall(4, 5, 'V'), wall(6, 1, 'H'), wall(3, 6, 'V')]
    );
  }

  it('stays inside the budget and delivers the promised depth untruncated', () => {
    getBestAction(midGame(), AI_PROFILES.hard);
    const stats = searchStats();
    expect(stats.elapsedMs).toBeLessThanOrEqual(AI_PROFILES.hard.timeBudgetMs + 60);
    expect(stats.depthReached).toBeGreaterThanOrEqual(AI_PROFILES.hard.depth);
    expect(stats.truncated).toBe(false);
  });

  it('node counts reflect the last call only', () => {
    const state = midGame();
    getBestAction(state, AI_PROFILES.normal, 1);
    const first = searchStats().nodes;
    getBestAction(state, AI_PROFILES.normal, 1);
    getBestAction(state, AI_PROFILES.normal, 1);
    const third = searchStats().nodes;
    expect(first).toBeGreaterThan(0);
    expect(third).toBeLessThanOrEqual(first * 2);
  });
});

// ---------------------------------------------------------------------------
// 6. Every mode: legal, deterministic
// ---------------------------------------------------------------------------

describe('mode coverage', () => {
  const cases: Array<[GameMode, PlayerState[]]> = [
    ['2p', [player(0, 8, 4, 'TOP', 10), player(1, 0, 4, 'BOTTOM', 10)]],
    [
      '4p',
      [
        player(0, 8, 4, 'TOP', 5),
        player(1, 0, 4, 'BOTTOM', 5),
        player(2, 4, 0, 'RIGHT', 5),
        player(3, 4, 8, 'LEFT', 5),
      ],
    ],
    ['race2', [player(0, 8, 2, 'TOP', 10), player(1, 8, 6, 'TOP', 10)]],
    [
      'race3',
      [player(0, 8, 1, 'TOP', 5), player(1, 8, 4, 'TOP', 5), player(2, 8, 7, 'TOP', 5)],
    ],
    [
      'race4',
      [
        player(0, 8, 1, 'TOP', 5),
        player(1, 8, 3, 'TOP', 5),
        player(2, 8, 5, 'TOP', 5),
        player(3, 8, 7, 'TOP', 5),
      ],
    ],
    ['center2', [player(0, 8, 4, 'TOP', 10), player(1, 0, 4, 'BOTTOM', 10)]],
    [
      'center3',
      [
        player(0, 8, 4, 'TOP', 5),
        player(1, 0, 4, 'BOTTOM', 5),
        player(2, 4, 0, 'RIGHT', 5),
      ],
    ],
  ];

  it.each(cases)('%s: returns a legal action', (mode, players) => {
    const state = makeState(mode, players);
    const action = getBestAction(state, AI_PROFILES.hard, 7);
    expect(action).not.toBeNull();
    const pid = players[0].id;
    if (action!.type === 'MOVE' && action!.type === 'MOVE') {
      const legal = getLegalMoves(state, pid);
      expect(
        legal.some((c) => action!.type === 'MOVE' && c.row === action!.to.row && c.col === action!.to.col)
      ).toBe(true);
    } else if (action!.type === 'PLACE_WALL') {
      expect(isLegalWallPlacement(state, pid, (action as any).wall)).toBe(true);
    }
  });

  it.each(cases.filter(([m]) => m === '2p' || m === 'race2' || m === 'center2'))(
    '%s: deterministic per position',
    (mode, players) => {
      const state = makeState(mode, players);
      expect(getBestAction(state, AI_PROFILES.hard, 7)).toEqual(
        getBestAction(state, AI_PROFILES.hard, 7)
      );
    }
  );

  it('4p: finishes when it can', () => {
    // 4p is a CENTER mode: the win is the middle square (4,4), not an edge.
    // (An earlier revision parked p1 at (1,4) expecting (0,4) to finish,
    // which can never win in this mode.) p1 stands next to the nexus with
    // the move to play: converting beats everything, always.
    const state = makeState('4p', [
      player(0, 3, 4, 'TOP', 5),
      player(1, 5, 4, 'BOTTOM', 5),
      player(2, 4, 0, 'RIGHT', 5),
      player(3, 4, 8, 'LEFT', 5),
    ]);
    expect(getBestAction(state, AI_PROFILES.hard)).toEqual({ type: 'MOVE', to: { row: 4, col: 4 } });
  });

  it('getCandidateActions still returns moves plus wall candidates', () => {
    const state = makeState('2p', [player(0, 5, 4, 'TOP', 8), player(1, 3, 4, 'BOTTOM', 8)]);
    const actions = getCandidateActions(state, 'p1', 4);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.type === 'MOVE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Integration: two AIs finish a game without stalling
// ---------------------------------------------------------------------------

describe('self-play', () => {
  it('two AIs complete a 2p game', () => {
    let state = makeState('2p', [player(0, 8, 4, 'TOP', 10), player(1, 0, 4, 'BOTTOM', 10)]);
    let plies = 0;
    while (state.status === 'IN_PROGRESS' && plies < 140) {
      const action = getBestAction(state, AI_PROFILES.normal, 1234 + plies);
      expect(action).not.toBeNull();
      if (!action) break;
      const applied = applyAction(state, action);
      expect(applied.success).toBe(true);
      if (!applied.success) break;
      state = applied.state;
      plies++;
    }
    expect(state.status).toBe('COMPLETED');
    expect(state.winnerId).not.toBeNull();
  });
});