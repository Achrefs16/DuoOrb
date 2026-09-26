import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

const WINDOW = 60_000;

describe('RateLimiter', () => {
  // The sliding-window behaviour is time-dependent, so drive the clock.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to the limit then rejects', () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(rl.allow('a', 5, WINDOW)).toBe(true);
    }
    expect(rl.allow('a', 5, WINDOW)).toBe(false);
  });

  it('keys independently per caller', () => {
    const rl = new RateLimiter();
    for (let i = 0; i < 5; i++) rl.allow('a', 5, WINDOW);
    expect(rl.allow('a', 5, WINDOW)).toBe(false);
    // A different IP must be unaffected — this is the whole point of keying.
    expect(rl.allow('b', 5, WINDOW)).toBe(true);
  });

  it('releases capacity as the window slides, not on a clock boundary', () => {
    const rl = new RateLimiter();
    // Two hits deliberately spaced apart so expiry is observable one at a time.
    expect(rl.allow('a', 2, 10)).toBe(true); // t = 0
    vi.advanceTimersByTime(6);
    expect(rl.allow('a', 2, 10)).toBe(true); // t = 6
    expect(rl.allow('a', 2, 10)).toBe(false); // t = 6, budget spent

    // t = 9: the t=0 hit is still inside the window, so still nothing free.
    vi.advanceTimersByTime(3);
    expect(rl.allow('a', 2, 10)).toBe(false);

    // t = 10: exactly the t=0 hit has now expired, freeing exactly one slot.
    // The t=6 hit survives, so the next call must be refused again.
    vi.advanceTimersByTime(1);
    expect(rl.allow('a', 2, 10)).toBe(true);
    expect(rl.allow('a', 2, 10)).toBe(false);
  });

  it('does not hand out a whole new budget at a window boundary', () => {
    const rl = new RateLimiter();
    // Burn the budget immediately.
    expect(rl.allow('a', 1, 1000)).toBe(true);
    expect(rl.allow('a', 1, 1000)).toBe(false);
    // A fixed/bucketed limiter keyed on floor(now/window) would allow this if
    // the boundary happened to fall here. A sliding one must not.
    vi.advanceTimersByTime(500);
    expect(rl.allow('a', 1, 1000)).toBe(false);
  });

  it('ignores a rejected hit when counting', () => {
    const rl = new RateLimiter();
    rl.allow('a', 1, WINDOW);
    for (let i = 0; i < 50; i++) rl.allow('a', 1, WINDOW);
    expect(rl.countFor('a', WINDOW)).toBe(1);
  });

  it('drops keys once fully expired so memory does not grow forever', () => {
    const rl = new RateLimiter();
    rl.allow('a', 5, 10);
    rl.allow('b', 5, 10);
    expect(rl.trackedKeys).toBe(2);

    vi.advanceTimersByTime(11);
    rl.allow('c', 5, 10);
    // The sweep only runs on the periodic interval, so force it.
    vi.advanceTimersByTime(60_001);
    rl.allow('d', 5, 10);
    expect(rl.trackedKeys).toBeLessThanOrEqual(2);
  });

  it('never stores a raw IP in the key', () => {
    const ip = '203.0.113.7';
    const key = RateLimiter.ipKey(ip);
    expect(key).not.toContain('203.0.113.7');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    // Same input, same key; different input, different key.
    expect(RateLimiter.ipKey(ip)).toBe(key);
    expect(RateLimiter.ipKey('203.0.113.8')).not.toBe(key);
  });

  it('buckets a missing IP under a stable key rather than throwing', () => {
    expect(RateLimiter.ipKey(undefined)).toBe(RateLimiter.ipKey(undefined));
  });
});
