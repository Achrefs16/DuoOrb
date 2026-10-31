/**
 * Chess-style time controls. `incrementSeconds` is Fischer increment:
 * credited to the mover's clock after every move or wall placement.
 */
export type TimeCategory = 'bullet' | 'blitz' | 'rapid' | 'untimed';

export interface TimeControl {
  id: string;
  /** Full label, e.g. "Blitz 3+0". */
  name: string;
  /** Compact chip label, e.g. "3+0". */
  short: string;
  minutes: number;
  incrementSeconds: number;
  category?: TimeCategory;
}

export const NO_TIMER_CONTROL: TimeControl = {
  id: 'no-timer',
  name: 'No Timer',
  short: 'No Timer',
  minutes: 0,
  incrementSeconds: 0,
  category: 'untimed',
};

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-1-0', name: 'Bullet 1+0', short: '1+0', minutes: 1, incrementSeconds: 0, category: 'bullet' },
  { id: 'bullet-1-1', name: 'Bullet 1+1', short: '1+1', minutes: 1, incrementSeconds: 1, category: 'bullet' },
  { id: 'rapid-3-0', name: 'Blitz 3+0', short: '3+0', minutes: 3, incrementSeconds: 0, category: 'blitz' },
  { id: 'rapid-5-0', name: 'Blitz 5+0', short: '5+0', minutes: 5, incrementSeconds: 0, category: 'blitz' },
];

export const DEFAULT_TIME_CONTROL: TimeControl = TIME_CONTROLS[2];

export function formatTimeControlDisplay(tc: TimeControl): string {
  if (tc.id === 'no-timer') return 'No Timer';
  if (tc.incrementSeconds > 0) {
    return `${tc.minutes} + ${tc.incrementSeconds}`;
  }
  return `${tc.minutes} min`;
}

/**
 * Effective per-move bonus for a match: the preset's own increment, or zero.
 * +0 clocks are pure countdown — no phantom bonus. Zero when disabled.
 */
export function effectiveIncrement(tc: TimeControl, incrementEnabled: boolean): number {
  if (!incrementEnabled) return 0;
  return tc.incrementSeconds;
}

export function getTimeControl(id?: string): TimeControl {
  if (id === 'no-timer') return NO_TIMER_CONTROL;
  return TIME_CONTROLS.find((tc) => tc.id === id) ?? DEFAULT_TIME_CONTROL;
}

export function isUntimedTimeControl(tc?: TimeControl | null): boolean {
  if (!tc) return false;
  return tc.id === 'no-timer' || tc.category === 'untimed' || tc.minutes <= 0;
}

/**
 * Master switch for the chess clock in local and AI matches.
 *
 * `true` for live play: countdown, timeout losses and the 30s warning are all
 * active in local/AI games. Flip to `false` while testing positions, so no
 * match can be lost on time. Online matches are unaffected — their clocks
 * are server-synchronized and never read this flag.
 */
export const CLOCK_ENABLED = true;
