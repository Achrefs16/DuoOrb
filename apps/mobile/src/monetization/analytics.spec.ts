import { describe, expect, it, beforeEach } from 'vitest';
import {
  __clearTrackedEvents,
  __readTrackedEvents,
  track,
} from './analytics';

/** Paywall event bus (MONETIZATION.md P7.5): buffered, bounded, silent. */
describe('paywall analytics', () => {
  beforeEach(() => {
    __clearTrackedEvents();
  });

  it('buffers events with payloads in order', () => {
    track('paywall_viewed', { entry: 'settings' });
    track('plan_selected', { plan: 'yearly' });
    const events = __readTrackedEvents();
    expect(events.map((e) => e.event)).toEqual(['paywall_viewed', 'plan_selected']);
    expect(events[0].props).toEqual({ entry: 'settings' });
  });

  it('caps the buffer so a long session cannot leak memory', () => {
    for (let i = 0; i < 150; i += 1) track('premium_feature_used', { n: i });
    expect(__readTrackedEvents()).toHaveLength(100);
  });
});
