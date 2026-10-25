import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  getLegalMoves,
  type RecordedAction,
} from '@duoorb/game-core';
import { analyzeMatchLocal } from './localReview';

function buildHistory(plies: number): {
  initial: ReturnType<typeof createInitialState>;
  history: RecordedAction[];
} {
  const initial = createInitialState({
    gameId: 'local-review-test',
    mode: '2p',
    playerNames: ['You', 'Bot'],
  });
  let state = initial;
  const history: RecordedAction[] = [];
  for (let i = 0; i < plies; i++) {
    const player = state.players[state.currentPlayerIndex];
    const legal = getLegalMoves(state, player.id);
    const result = applyAction(state, { type: 'MOVE', to: legal[0] });
    if (!result.success) throw new Error('test move was rejected');
    history.push({
      sequence: i + 1,
      playerId: player.id,
      action: { type: 'MOVE', to: legal[0] },
      timestamp: 1_700_000_000_000 + i,
    });
    state = result.state;
  }
  return { initial, history };
}

describe('offline local review', () => {
  it('analyzes every recorded ply without the server', async () => {
    const { initial, history } = buildHistory(3);
    const review = await analyzeMatchLocal(initial, history, { budgetMs: 2 });
    expect(review.moveAnalyses).toHaveLength(3);
    expect(review.totalMoves).toBe(3);
    expect(review.analysisVersion).toBe('analysis-local-1.0');
    expect(review.winChanceHistory).toHaveLength(4);
    expect(review.summary.totalMoves).toBe(3);
    expect(review.accuracies?.p1).toBeTypeOf('number');
    for (const move of review.moveAnalyses) {
      expect(move.step).toBeGreaterThan(0);
      expect(move.assessment).toBeTruthy();
      expect(move.evaluationLoss).toBeGreaterThanOrEqual(0);
    }
  }, 20_000);
});
