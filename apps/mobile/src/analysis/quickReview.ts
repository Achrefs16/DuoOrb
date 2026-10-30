import type { MoveAssessment } from '@duoorb/game-core';

export type MoveQualityCounts = Record<MoveAssessment, number>;

export interface GameOverBadgeSelection {
  left: MoveAssessment;
  middle: 'BEST';
  right: MoveAssessment;
}

const LEFT_PRIORITY: MoveAssessment[] = [
  'BRILLIANT',
  'GREAT',
  'EXCELLENT',
  'GOOD',
];
const RIGHT_PRIORITY: MoveAssessment[] = ['BLUNDER', 'MISTAKE', 'INACCURACY'];
const RIGHT_POSITIVE_FALLBACK: MoveAssessment[] = [
  'EXCELLENT',
  'GREAT',
  'GOOD',
  'BRILLIANT',
];

export function emptyMoveQualityCounts(): MoveQualityCounts {
  return {
    BRILLIANT: 0,
    GREAT: 0,
    BEST: 0,
    EXCELLENT: 0,
    GOOD: 0,
    INACCURACY: 0,
    MISTAKE: 0,
    BLUNDER: 0,
    FORCED: 0,
  };
}

/**
 * Modal layout rule:
 * - left is the best positive non-Best signal,
 * - middle is always Best,
 * - right is the worst negative signal when present, otherwise the next
 *   positive signal so the row never jumps or shows a meaningless red zero.
 */
export function selectGameOverBadges(
  counts: MoveQualityCounts
): GameOverBadgeSelection {
  const left =
    LEFT_PRIORITY.find((assessment) => counts[assessment] > 0) ?? 'GREAT';

  let right = RIGHT_PRIORITY.find((assessment) => counts[assessment] > 0);
  if (!right) {
    right = RIGHT_POSITIVE_FALLBACK.find(
      (assessment) => assessment !== left && counts[assessment] > 0
    );
  }
  if (!right) {
    right = left === 'EXCELLENT' ? 'GREAT' : 'EXCELLENT';
  }

  return { left, middle: 'BEST', right };
}
