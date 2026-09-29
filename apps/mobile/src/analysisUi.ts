import type { MoveAssessment } from '@duoorb/game-core';
import { THEME } from './theme';

/** Restrained assessment colors — only markers use them, never whole screens. */
export function assessmentColor(a: MoveAssessment): string {
  switch (a) {
    case 'BEST':
      return THEME.colors.assessmentBest;
    case 'EXCELLENT':
      return THEME.colors.assessmentExcellent;
    case 'GOOD':
      return THEME.colors.assessmentGood;
    case 'INACCURACY':
      return THEME.colors.assessmentInaccuracy;
    case 'MISTAKE':
      return THEME.colors.assessmentBlunder;
    case 'BLUNDER':
      return THEME.colors.danger;
  }
}

/** Engine alternative markers always use teal to contrast actual-move marks. */
export const ENGINE_TEAL = THEME.colors.assessmentBest;

/** 'AI (NORMAL)' -> 'AI'. Real display names only, never invented. */
export function cleanName(displayName?: string): string {
  const cleaned = (displayName ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
  return cleaned.length > 0 ? cleaned : 'Player';
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
