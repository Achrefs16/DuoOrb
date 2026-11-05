import { describe, expect, it } from 'vitest';
import { getSimulatedOnlineBaseline } from './presence-simulator.js';

describe('presence-simulator', () => {
  it('keeps online counts within the expected realistic bounds (38 to 185)', () => {
    // Test across all 24 hours of a day
    const baseTime = Date.UTC(2026, 10, 5, 0, 0, 0);
    for (let hour = 0; hour < 24; hour++) {
      const t = baseTime + hour * 3600_000;
      const count = getSimulatedOnlineBaseline(t);
      expect(count).toBeGreaterThanOrEqual(38);
      expect(count).toBeLessThanOrEqual(185);
    }
  });

  it('produces smooth changes across consecutive minutes', () => {
    const t1 = Date.UTC(2026, 10, 5, 14, 0, 0);
    const t2 = Date.UTC(2026, 10, 5, 14, 1, 0);
    const c1 = getSimulatedOnlineBaseline(t1);
    const c2 = getSimulatedOnlineBaseline(t2);
    expect(Math.abs(c1 - c2)).toBeLessThanOrEqual(5);
  });
});

