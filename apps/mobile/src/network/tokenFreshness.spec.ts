import { describe, expect, it } from 'vitest';
import {
  decodeJwtExpMs,
  isTokenFresh,
  TOKEN_FRESHNESS_SKEW_MS,
} from './tokenFreshness';

function jwt(expSec: number | null): string {
  const payload =
    expSec === null ? { sub: 'u1' } : { sub: 'u1', exp: expSec };
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

/** Token freshness decoding (ONLINE_HEALTH Phase A): stale tokens must read stale. */
describe('token freshness', () => {
  const now = Date.now();

  it('decodes exp in epoch ms', () => {
    expect(decodeJwtExpMs(jwt(Math.floor(now / 1000) + 3600))).toBeGreaterThan(now);
  });

  it('returns null for garbage (fail-closed)', () => {
    expect(decodeJwtExpMs(null)).toBeNull();
    expect(decodeJwtExpMs('')).toBeNull();
    expect(decodeJwtExpMs('not-a-jwt')).toBeNull();
    expect(decodeJwtExpMs(jwt(null))).toBeNull();
  });

  it('treats expired and margin-dying tokens as stale', () => {
    expect(isTokenFresh(jwt(Math.floor(now / 1000) - 10), now)).toBe(false);
    expect(
      isTokenFresh(jwt(Math.floor(now / 1000) + 30), now, TOKEN_FRESHNESS_SKEW_MS)
    ).toBe(false);
    expect(
      isTokenFresh(jwt(Math.floor(now / 1000) + 3600), now, TOKEN_FRESHNESS_SKEW_MS)
    ).toBe(true);
  });
});
