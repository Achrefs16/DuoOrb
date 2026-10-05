/**
 * Paywall analytics (MONETIZATION.md P7.5): minimal event bus.
 *
 * No analytics SDK is installed yet — `track()` logs in dev and no-ops in
 * production builds, with a bounded in-memory buffer tests can assert on.
 * When an SDK lands (P9 hardening), only this file changes: every call site
 * keeps its name + payload shape.
 */

export type PaywallEvent =
  | 'paywall_viewed'
  | 'plan_selected'
  | 'trial_started'
  | 'purchase_completed'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'restored'
  | 'reward_offered'
  | 'reward_completed'
  | 'interstitial_shown'
  | 'interstitial_dismissed'
  | 'premium_feature_used'
  | 'entitlement_changed';

const BUFFER_LIMIT = 100;
const buffer: { event: PaywallEvent; props?: Record<string, unknown> }[] = [];

export function track(event: PaywallEvent, props?: Record<string, unknown>): void {
  buffer.push({ event, props });
  while (buffer.length > BUFFER_LIMIT) buffer.shift();
  // typeof-guard (same as sfx.ts): bare __DEV__ throws in contexts where
  // react-native never initialized the global (unit tests, web workers).
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[paywall] ${event}`, props ?? '');
  }
}

/** Test seam: inspect + clear the buffer. */
export function __readTrackedEvents(): {
  event: PaywallEvent;
  props?: Record<string, unknown>;
}[] {
  return [...buffer];
}

export function __clearTrackedEvents(): void {
  buffer.length = 0;
}
