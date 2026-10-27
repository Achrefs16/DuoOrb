import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createInitialState,
  type GameAction,
  type GameState,
} from '@duoorb/game-core';
import {
  emptyMoveQualityCounts,
  getQuickReviewCounts,
  selectGameOverBadges,
} from './quickReview';

function play(state: GameState, playerId: string, action: GameAction): GameState {
  const index = state.players.findIndex((player) => player.id === playerId);
  expect(index).toBeGreaterThanOrEqual(0);
  const result = applyAction(
    { ...state, currentPlayerIndex: index },
    action,
    { timestamp: state.history.length + 1 }
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.state;
}

function counts(overrides: Partial<ReturnType<typeof emptyMoveQualityCounts>>) {
  return { ...emptyMoveQualityCounts(), ...overrides };
}

describe('quick review badges', () => {
  it('pins Best in the middle and puts the strongest signal at each side', () => {
    expect(
      selectGameOverBadges(
        counts({ BRILLIANT: 1, BLUNDER: 2, BEST: 4, GREAT: 7, EXCELLENT: 5 })
      )
    ).toEqual({ left: 'BRILLIANT', middle: 'BEST', right: 'BLUNDER' });

    expect(
      selectGameOverBadges(counts({ BEST: 4, GREAT: 7, EXCELLENT: 5 }))
    ).toEqual({ left: 'GREAT', middle: 'BEST', right: 'EXCELLENT' });

    expect(
      selectGameOverBadges(counts({ BEST: 4, GREAT: 7, BLUNDER: 1 }))
    ).toEqual({ left: 'GREAT', middle: 'BEST', right: 'BLUNDER' });

    expect(
      selectGameOverBadges(counts({ BRILLIANT: 1, BEST: 4, EXCELLENT: 5 }))
    ).toEqual({ left: 'BRILLIANT', middle: 'BEST', right: 'EXCELLENT' });
  });

  it('never duplicates a category when one side has no signal', () => {
    expect(selectGameOverBadges(counts({ BEST: 4, GOOD: 6 }))).toEqual({
      left: 'GOOD',
      middle: 'BEST',
      right: 'EXCELLENT',
    });

    expect(selectGameOverBadges(counts({ BEST: 4, EXCELLENT: 6 }))).toEqual({
      left: 'EXCELLENT',
      middle: 'BEST',
      right: 'GREAT',
    });
  });

  it('counts every played move for the viewer without touching the network', () => {
    let state = createInitialState({ gameId: 'quick-review-test', mode: '2p' });
    const initialState = state;

    state = play(state, 'p1', { type: 'MOVE', to: { row: 7, col: 4 } });
    state = play(state, 'p2', { type: 'MOVE', to: { row: 1, col: 4 } });
    state = play(state, 'p1', { type: 'MOVE', to: { row: 6, col: 4 } });
    state = play(state, 'p2', { type: 'MOVE', to: { row: 2, col: 4 } });
    state = play(state, 'p1', { type: 'MOVE', to: { row: 5, col: 4 } });
    state = play(state, 'p2', { type: 'MOVE', to: { row: 3, col: 4 } });

    const result = getQuickReviewCounts(
      initialState,
      state.history,
      'p1'
    );

    expect(Object.values(result).reduce((sum, value) => sum + value, 0)).toBe(3);
    expect(result.BEST).toBe(3);
    expect(result.BLUNDER).toBe(0);
  });

  it('flags a move that ignores an immediate win and retreats', () => {
    const base = createInitialState({
      gameId: 'quick-review-blunder',
      mode: '2p',
    });
    const initialState: GameState = {
      ...base,
      currentPlayerIndex: 0,
      players: base.players.map((player) => {
        if (player.id === 'p1') {
          return { ...player, position: { row: 2, col: 4 } };
        }
        if (player.id === 'p2') {
          return { ...player, position: { row: 1, col: 4 } };
        }
        return player;
      }),
    };

    const state = play(initialState, 'p1', {
      type: 'MOVE',
      to: { row: 3, col: 4 },
    });
    const result = getQuickReviewCounts(initialState, state.history, 'p1');

    expect(result.BLUNDER).toBe(1);
    expect(selectGameOverBadges(result)).toEqual({
      left: 'GREAT',
      middle: 'BEST',
      right: 'BLUNDER',
    });
  });
});
