import { Injectable, Logger } from '@nestjs/common';
import { sha256 } from './guest-token.js';

/**
 * In-process fixed-window rate limiter, keyed on a hashed client IP.
 *
 * Deliberately not Redis: the server runs as a single instance, and an
 * unauthenticated endpoint that mints database rows is the one place where an
 * in-memory limiter has to exist even though it resets on restart. Hashing the
 * IP means we never hold personal data just to count requests.
 */
@Injectable()
export class RateLimiter {
  private readonly logger = new Logger(RateLimiter.name);
  private hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  /**
   * @returns true when the request is allowed.
   */
  allow(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    this.sweep(now);

    const bucketKey = `${key}:${Math.floor(now / windowMs)}`;
    const entry = this.hits.get(bucketKey);
    if (!entry) {
      this.hits.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  /** Hashed IP, so the key never contains a raw address. */
  static ipKey(ip: string | undefined): string {
    return sha256(ip || 'unknown');
  }

  private sweep(now: number): void {
    // Cheap periodic cleanup; without it the map grows for the process life.
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt < now) this.hits.delete(key);
    }
  }

  get trackedKeys(): number {
    return this.hits.size;
  }
}
