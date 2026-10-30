import { describe, expect, it } from 'vitest';
import {
  emptyMoveQualityCounts,
  selectGameOverBadges,
} from './quickReview';

function counts(overrides: Partial<ReturnType<typeof emptyMoveQualityCounts>>) {
  return { ...emptyMoveQualityCounts(), ...overrides };
}

describe('game over badge selection', () => {
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
});
