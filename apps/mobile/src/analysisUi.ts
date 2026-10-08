import type { MoveAssessment, RecordedAction } from '@duoorb/game-core';
import { formatAction } from '@duoorb/game-core';
import { THEME } from './theme';

/** Restrained assessment colors — only markers use them, never whole screens. */
export function assessmentColor(a?: MoveAssessment): string {
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
    default:
      return THEME.colors.assessmentGood;
  }
}

/** Engine alternative markers always use teal to contrast actual-move marks. */
export const ENGINE_TEAL = THEME.colors.assessmentBest;

/**
 * Chess-style classification glyphs for the review board + coach line:
 * blunder ??, mistake ?, inaccuracy ?!, best ★ (white star). Lesser moves
 * show none. The star renders through the system font fallback.
 */
export function assessmentGlyph(a?: MoveAssessment): string {
  switch (a) {
    case 'BLUNDER':
      return '??';
    case 'MISTAKE':
      return '?';
    case 'INACCURACY':
      return '?!';
    case 'BEST':
      return '★';
    default:
      return '';
  }
}

/**
 * Badge fill per assessment. Best moves get a green star badge; everything
 * else wears its assessment color.
 */
export function assessmentBadgeColor(a?: MoveAssessment): string {
  if (a === 'BEST') return THEME.colors.success;
  return assessmentColor(a);
}

/** Verdict-word locale key for the coach line ("Hd4 is a blunder"). */
export function assessmentVerdictKey(
  a?: MoveAssessment
):
  | 'review.verdictBest'
  | 'review.verdictExcellent'
  | 'review.verdictGood'
  | 'review.verdictInaccuracy'
  | 'review.verdictMistake'
  | 'review.verdictBlunder' {
  switch (a) {
    case 'BEST':
      return 'review.verdictBest';
    case 'EXCELLENT':
      return 'review.verdictExcellent';
    case 'GOOD':
      return 'review.verdictGood';
    case 'INACCURACY':
      return 'review.verdictInaccuracy';
    case 'MISTAKE':
      return 'review.verdictMistake';
    case 'BLUNDER':
      return 'review.verdictBlunder';
    default:
      return 'review.verdictGood';
  }
}

/**
 * Strip label: pawn moves show the bare destination (h3, e4 — no seat
 * letter); walls keep the full token (Hd4) since H/V carries the shape.
 */
export function shortMoveLabel(
  action: Parameters<typeof formatAction>[0] | undefined | null,
  playerIndex: number
): string {
  if (!action) return '—';
  const full = formatAction(action, playerIndex);
  if (action.type === 'MOVE') {
    return full.length > 1 ? full.slice(1) : full;
  }
  return full;
}

/** Signed one-decimal eval for coach pills and the eval bar. */
export function formatEvalShort(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
}

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
