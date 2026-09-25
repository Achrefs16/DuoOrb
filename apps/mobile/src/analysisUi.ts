import type { MoveAssessment } from '@duoorb/game-core';

/** Restrained assessment colors — only markers use them, never whole screens. */
export function assessmentColor(a: MoveAssessment): string {
  switch (a) {
    case 'BEST':
      return '#0D9488';
    case 'EXCELLENT':
      return '#059669';
    case 'GOOD':
      return '#16A34A';
    case 'INACCURACY':
      return '#D97706';
    case 'MISTAKE':
      return '#EA580C';
    case 'BLUNDER':
      return '#DC2626';
  }
}

/** Engine alternative markers always use teal to contrast actual-move marks. */
export const ENGINE_TEAL = '#0D9488';

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
