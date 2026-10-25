import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIME_CONTROL,
  NO_TIMER_CONTROL,
  TIME_CONTROLS,
  formatTimeControlDisplay,
  getTimeControl,
  isUntimedTimeControl,
} from './timeControls';

describe('timeControls', () => {
  it('returns NO_TIMER_CONTROL when requesting "no-timer"', () => {
    const tc = getTimeControl('no-timer');
    expect(tc).toEqual(NO_TIMER_CONTROL);
    expect(tc.id).toBe('no-timer');
    expect(tc.category).toBe('untimed');
    expect(tc.minutes).toBe(0);
  });

  it('returns matching preset for valid time control ids', () => {
    const tc = getTimeControl('bullet-1-0');
    expect(tc.id).toBe('bullet-1-0');
    expect(tc.minutes).toBe(1);
    expect(tc.incrementSeconds).toBe(0);
  });

  it('falls back to DEFAULT_TIME_CONTROL for unknown or undefined ids', () => {
    expect(getTimeControl('unknown-control')).toEqual(DEFAULT_TIME_CONTROL);
    expect(getTimeControl(undefined)).toEqual(DEFAULT_TIME_CONTROL);
  });

  it('correctly identifies untimed time controls', () => {
    expect(isUntimedTimeControl(NO_TIMER_CONTROL)).toBe(true);
    expect(isUntimedTimeControl({ id: 'no-timer', name: 'No Timer', short: 'No Timer', minutes: 0, incrementSeconds: 0 })).toBe(true);
    expect(isUntimedTimeControl({ id: 'custom-0', name: 'Untimed', short: 'Untimed', minutes: 0, incrementSeconds: 0, category: 'untimed' })).toBe(true);
    expect(isUntimedTimeControl({ id: 'custom-zero', name: 'Zero', short: '0', minutes: -1, incrementSeconds: 0 })).toBe(true);

    expect(isUntimedTimeControl(DEFAULT_TIME_CONTROL)).toBe(false);
    expect(isUntimedTimeControl(TIME_CONTROLS[0])).toBe(false);
    expect(isUntimedTimeControl(null)).toBe(false);
    expect(isUntimedTimeControl(undefined)).toBe(false);
  });

  it('formats display strings accurately', () => {
    expect(formatTimeControlDisplay(NO_TIMER_CONTROL)).toBe('No Timer');
    expect(formatTimeControlDisplay(DEFAULT_TIME_CONTROL)).toBe('3 min');
    expect(formatTimeControlDisplay(TIME_CONTROLS[1])).toBe('1 + 1');
  });
});
