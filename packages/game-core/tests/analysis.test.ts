import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_PROFILES,
  analyzeGame,
  analyzeMove,
  analyzePosition,
  computePositionMetrics,
  computeWallImpact,
  multiWinChances,
  summarizeTrend,
  winChanceFromEval,
} from '../src/analysis.js';
import { getBestAction, AI_PROFILES } from '../src/ai.js';
import { applyAction, createInitialState } from '../src/ruleset.js';
import { GameState } from '../src/types.js';

function playMoves(mode: '2p' | '4p' | 'race2', moves: Array<{ row: number; col: number }>) {
  let state = createInitialState({ mode });
  for (const to of moves) {
    const res = applyAction(state, { type: 'MOVE', to });
    if (!res.success) throw new Error(`illegal scripted move ${JSON.stringify(to)}`);
    state = res.state;
  }
  return state;
}

describe('Analysis engine: metrics', () => {
  it('measures the opening position sanely', () => {
    const state = createInitialState({ mode: '2p' });
    const m = computePositionMetrics(state, 'p1', 10, 10);
    expect(m.ownDistance).toBe(8);
    expect(m.closestThreatDistance).toBe(8);
    expect(m.raceAdvantage).toBe(0);
    expect(m.ownWalls).toBe(10);
    expect(m.ownMobility).toBe(3);
    expect(m.phase).toBe('OPENING');
    expect(m.moverRank).toBe(1);
    expect(m.reachableCells).toBe(81);
  });

  it('detects the endgame phase late', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[0].wallsRemaining = 0;
    state.players[1].wallsRemaining = 1;
    const m = computePositionMetrics(state, 'p1', 10, 10);
    expect(m.phase).toBe('ENDGAME');
    expect(m.ownDistance).toBe(1);
    expect(m.goalProgress).toBeCloseTo(7 / 8);
  });

  it('flags an immediate threat in analyzePosition', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[1].position = { row: 7, col: 4 };
    const report = analyzePosition(state, 'p1', 'fast');
    expect(report.immediateThreat).toBe(true);
    expect(report.bestActions.length).toBeGreaterThan(0);
  });
});

describe('Analysis engine: win chance', () => {
  it('is monotonic and centered', () => {
    expect(winChanceFromEval(0)).toBeCloseTo(0.5);
    expect(winChanceFromEval(100)).toBeGreaterThan(winChanceFromEval(20));
    expect(winChanceFromEval(-20)).toBeLessThan(0.5);
  });

  it('multiplayer chances sum to one', () => {
    const state = createInitialState({ mode: '4p' });
    const chances = multiWinChances(state);
    const sum = Object.values(chances).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe('Analysis engine: wall intelligence', () => {
  it('scores an efficient wall above a useless one', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 8, col: 6 };
    state.players[1].position = { row: 1, col: 4 };
    const before = computePositionMetrics(state, 'p1', 10, 10);

    // Efficient: blocks p2's finishing lane from below (p2 heads down).
    const good = applyAction(state, {
      type: 'PLACE_WALL',
      wall: { row: 1, col: 3, orientation: 'H' },
    });
    expect(good.success).toBe(true);
    if (!good.success) return;
    const goodImpact = computeWallImpact(
      before,
      computePositionMetrics(good.state, 'p1', 10, 10)
    );
    expect(goodImpact.opponentPathGain).toBeGreaterThan(0);

    // Useless: far corner, touches nothing.
    const state2 = createInitialState({ mode: '2p' });
    const before2 = computePositionMetrics(state2, 'p1', 10, 10);
    const bad = applyAction(state2, {
      type: 'PLACE_WALL',
      wall: { row: 7, col: 0, orientation: 'H' },
    });
    expect(bad.success).toBe(true);
    if (!bad.success) return;
    const badImpact = computeWallImpact(
      before2,
      computePositionMetrics(bad.state, 'p1', 10, 10)
    );
    expect(badImpact.opponentPathGain).toBe(0);
    expect(goodImpact.efficiencyScore).toBeGreaterThan(badImpact.efficiencyScore);
  });

  it('labels a do-nothing corner wall as waste', () => {
    const state = createInitialState({ mode: '2p' });
    const analysis = analyzeMove(
      state,
      { type: 'PLACE_WALL', wall: { row: 7, col: 0, orientation: 'H' } },
      'fast'
    );
    expect(analysis).not.toBeNull();
    expect(analysis?.categories.primary).toBe('WALL_WASTE');
  });
});

describe('Analysis engine: classification trust', () => {
  it("never calls the engine's own best move a blunder", () => {
    const state = createInitialState({ mode: '2p' });
    const best = getBestAction(state, { ...AI_PROFILES.normal, randomness: 0 });
    expect(best).not.toBeNull();
    if (!best) return;
    const analysis = analyzeMove(state, best, 'fast');
    expect(['BEST', 'EXCELLENT', 'GOOD']).toContain(analysis?.assessment);
  });

  it('scores mirror-symmetric alternatives identically (no false blame)', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 4, col: 4 };
    state.players[1].position = { row: 0, col: 0 };
    const left = analyzeMove(state, { type: 'MOVE', to: { row: 4, col: 3 } }, 'fast');
    const right = analyzeMove(state, { type: 'MOVE', to: { row: 4, col: 5 } }, 'fast');
    // Strategically equivalent options must get the same verdict and the
    // same loss — the engine must never single one out.
    expect(left?.assessment).toBe(right?.assessment);
    expect(Math.abs((left?.evaluationLoss ?? 0) - (right?.evaluationLoss ?? 0))).toBeLessThan(
      0.01
    );
  });

  it('detects a race reversal with a downgrade', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 6, col: 4 };
    // p1 steps back: was sole leader, now tied.
    const analysis = analyzeMove(state, { type: 'MOVE', to: { row: 2, col: 4 } }, 'fast');
    expect(analysis?.raceReversal).toBe(true);
    expect(['INACCURACY', 'MISTAKE', 'BLUNDER']).toContain(analysis?.assessment);
  });

  it('catches a missed immediate win with PV and try-again data', () => {
    const state = createInitialState({ mode: '2p' });
    state.players[0].position = { row: 1, col: 4 };
    state.players[1].position = { row: 5, col: 5 };
    // Deliberate blunder: walk away from an open goal.
    const analysis = analyzeMove(state, { type: 'MOVE', to: { row: 2, col: 4 } }, 'normal');
    expect(analysis?.missedWin).toBe(true);
    expect(analysis?.critical).toBe(true);
    expect(analysis?.principalVariation && analysis.principalVariation.length).toBeGreaterThan(0);
    expect(analysis?.tryAgain?.bestAction).toBeDefined();
    expect(['MISTAKE', 'BLUNDER']).toContain(analysis?.assessment);
  });
});

describe('Analysis engine: full game', () => {
  it('is deterministic across repeated runs', () => {
    const scripted: GameState = playMoves('2p', [
      { row: 7, col: 4 },
      { row: 1, col: 4 },
      { row: 6, col: 4 },
      { row: 1, col: 3 },
    ]);
    // tryAgain/deciding snapshots embed wall-clock timestamps from state
    // creation, so they are excluded: everything else must be identical.
    const strip = (r: unknown) =>
      JSON.stringify(r, (k, v) =>
        k === 'tryAgain' || k === 'beforeState' || k === 'afterState' ? undefined : v
      );
    const a = analyzeGame(
      createInitialState({ mode: '2p', gameId: 'det-1' }),
      scripted.history,
      'fast'
    );
    const b = analyzeGame(
      createInitialState({ mode: '2p', gameId: 'det-1' }),
      scripted.history,
      'fast'
    );
    expect(strip(a)).toBe(strip(b));
  });

  it('summarizes accuracy, moments and lessons', () => {
    const scripted = playMoves('2p', [
      { row: 7, col: 4 },
      { row: 1, col: 4 },
      { row: 6, col: 4 },
      { row: 2, col: 4 },
      { row: 5, col: 4 },
      { row: 3, col: 4 },
    ]);
    const review = analyzeGame(
      createInitialState({ mode: '2p', gameId: 'sum-1' }),
      scripted.history,
      'fast'
    );
    expect(review.totalMoves).toBe(6);
    expect(review.moveAnalyses).toHaveLength(6);
    expect(review.evaluationHistory).toHaveLength(7);
    expect(review.winChanceHistory).toHaveLength(7);
    expect(review.engineVersion).toBeTruthy();
    const acc = review.summary.accuracy.p1?.accuracy ?? 0;
    expect(acc).toBeGreaterThan(0);
    expect(acc).toBeLessThanOrEqual(100);
    expect(review.summary.confidence).toMatch(/low|medium|high/);
    expect(review.summary.keyLesson.title).toBeTruthy();
  });
});

describe('Analysis engine: trends', () => {
  it('refuses leaks below the sample gate but finds waste patterns', () => {
    const wasteful = playMoves('2p', [
      { row: 7, col: 4 },
      { row: 1, col: 4 },
    ]);
    const base = createInitialState({ mode: '2p', gameId: 'trend-base' });
    const review = analyzeGame(base, wasteful.history, 'fast');
    const few = summarizeTrend([review.summary]);
    expect(few.games).toBe(1);
    expect(few.leak).toBeUndefined();

    const many = summarizeTrend(
      Array.from({ length: 12 }, () => ({
        ...review.summary,
        wallWasteCount: 3,
        panicWallCount: 0,
      }))
    );
    expect(many.games).toBe(12);
    expect(many.accuracyTrend).toHaveLength(12);
    expect(many.leak).toMatch(/waste/i);
  });
});
