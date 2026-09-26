import { Injectable } from '@nestjs/common';
import { sha256 } from './guest-token.js';

/** Hard cap on tracked keys so a spray of source IPs cannot exhaust memory. */
const MAX_TRACKED_KEYS = 10_000;

/** How often expired keys are swept. */
const SWEEP_INTERVAL_MS = 60_000;

interface Bucket {
  /** Timestamps of accepted hits still inside the window, oldest first. */
  hits: number[];
  /** Window this bucket was created with, needed to know when it can be dropped. */
  windowMs: number;
}

/**
 * In-process sliding-window rate limiter, keyed on a hashed client IP.
 *
 * Deliberately not Redis: the server runs as a single instance, and an
 * unauthenticated endpoint that mints database rows is the one place where an
 * in-memory limiter has to exist even though it resets on restart. Hashing the
 * IP means we never hold personal data just to count requests.
 *
 * The window SLIDES. The previous implementation bucketed on
 * `floor(now / windowMs)`, which aligned every key to the clock hour: a client
 * that used its whole budget at 10:59 got a fresh budget at 11:00, and one
 * that used it at 10:01 got nothing for the next 59 minutes. Keeping
 * timestamps and expiring them individually removes that cliff and makes
 * "N per window" mean what it says.
 */
@Injectable()
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  /**
   * @returns true when the request is allowed.
   */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    this.sweep(now);

    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= MAX_TRACKED_KEYS) {
        this.evictOldest();
      }
      bucket = { hits: [now], windowMs };
      this.buckets.set(key, bucket);
      return true;
    }

    // Expire everything that has fallen out of the window.
    let expired = 0;
    while (expired < bucket.hits.length && now - bucket.hits[expired] >= windowMs) {
      expired++;
    }
    if (expired > 0) bucket.hits.splice(0, expired);

    if (bucket.hits.length >= limit) {
      return false;
    }

    bucket.hits.push(now);
    return true;
  }

  /** Hashed IP, so the key never contains a raw address. */
  static ipKey(ip: string | undefined): string {
    return sha256(ip || 'unknown');
  }

  /** Hits currently counted against a key. Exposed for tests and diagnostics. */
  countFor(key: string, windowMs: number): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return 0;
    const now = Date.now();
    let live = 0;
    for (let i = 0; i < bucket.hits.length; i++) {
      if (now - bucket.hits[i] < windowMs) live++;
    }
    return live;
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, bucket] of this.buckets) {
      const first = bucket.hits[0];
      if (first < oldestAt) {
        oldestAt = first;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) this.buckets.delete(oldestKey);
  }

  /** Cheap periodic cleanup; without it the map grows for the process life. */
  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      const windowMs = bucket.windowMs;
      while (bucket.hits.length > 0 && now - bucket.hits[0] >= windowMs) {
        bucket.hits.shift();
      }
      if (bucket.hits.length === 0) this.buckets.delete(key);
    }
  }

  get trackedKeys(): number {
    return this.buckets.size;
  }
}
