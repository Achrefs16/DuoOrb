/**
 * Chess-style time controls. `incrementSeconds` is Fischer increment:
 * credited to the mover's clock after every move or wall placement.
 */
export interface TimeControl {
  id: string;
  /** Full label, e.g. "Rapid 3+0". */
  name: string;
  /** Compact chip label, e.g. "3+0". */
  short: string;
  minutes: number;
  incrementSeconds: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-1-0', name: 'Bullet 1+0', short: '1+0', minutes: 1, incrementSeconds: 0 },
  { id: 'bullet-1-1', name: 'Bullet 1+1', short: '1+1', minutes: 1, incrementSeconds: 1 },
  { id: 'rapid-3-0', name: 'Rapid 3+0', short: '3+0', minutes: 3, incrementSeconds: 0 },
  { id: 'blitz-3-2', name: 'Blitz 3+2', short: '3+2', minutes: 3, incrementSeconds: 2 },
  { id: 'rapid-5-0', name: 'Rapid 5+0', short: '5+0', minutes: 5, incrementSeconds: 0 },
  { id: 'rapid-5-3', name: 'Rapid 5+3', short: '5+3', minutes: 5, incrementSeconds: 3 },
  { id: 'rapid-10-0', name: 'Rapid 10+0', short: '10+0', minutes: 10, incrementSeconds: 0 },
];

export const DEFAULT_TIME_CONTROL: TimeControl = TIME_CONTROLS[2];

/**
 * Effective per-move bonus for a match: the preset's own increment, or zero.
 * +0 clocks are pure countdown — no phantom bonus. Zero when disabled.
 */
export function effectiveIncrement(tc: TimeControl, incrementEnabled: boolean): number {
  if (!incrementEnabled) return 0;
  return tc.incrementSeconds;
}

export function getTimeControl(id?: string): TimeControl {
  return TIME_CONTROLS.find((tc) => tc.id === id) ?? DEFAULT_TIME_CONTROL;
}
