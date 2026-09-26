import { describe, expect, it } from 'vitest';
import {
  newOpaqueToken,
  newRefreshToken,
  sha256,
  signGuestAccessToken,
  verifyGuestAccessToken,
} from './guest-token.js';

const SECRET = Buffer.from('a'.repeat(48), 'utf8');
const OTHER = Buffer.from('b'.repeat(48), 'utf8');

describe('guest access token', () => {
  it('round-trips a signed token', () => {
    const { token } = signGuestAccessToken('u_abc12345', SECRET, 3600);
    const claims = verifyGuestAccessToken(token, [SECRET]);
    expect(claims?.sub).toBe('u_abc12345');
  });

  it('rejects a token signed with a different key', () => {
    const { token } = signGuestAccessToken('u_abc12345', OTHER, 3600);
    expect(verifyGuestAccessToken(token, [SECRET])).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const { token } = signGuestAccessToken('u_abc12345', SECRET, 3600);
    const [head, body, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'u_someoneelse', typ: 'duoorb-guest', iat: 0, exp: 99999999999 })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(verifyGuestAccessToken(`${head}.${forged}.${sig}`, [SECRET])).toBeNull();
    expect(body.length).toBeGreaterThan(0);
  });

  it('rejects an expired token', () => {
    // Signed two minutes ago with a 60s lifetime, so it is unambiguously past.
    const past = Date.now() - 120_000;
    const { token } = signGuestAccessToken('u_abc12345', SECRET, 60, past);
    expect(verifyGuestAccessToken(token, [SECRET])).toBeNull();
  });

  it('accepts a token that has not expired yet', () => {
    const justNow = Date.now() - 5_000;
    const { token } = signGuestAccessToken('u_abc12345', SECRET, 3600, justNow);
    expect(verifyGuestAccessToken(token, [SECRET])?.sub).toBe('u_abc12345');
  });

  it('accepts a token during key rotation when any key matches', () => {
    const { token } = signGuestAccessToken('u_abc12345', OTHER, 3600);
    // First key signs new tokens; the old key must still verify.
    expect(verifyGuestAccessToken(token, [SECRET, OTHER])?.sub).toBe('u_abc12345');
    expect(verifyGuestAccessToken(token, [SECRET])).toBeNull();
  });

  it('rejects an "alg: none" style token', () => {
    const head = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const body = Buffer.from(
      JSON.stringify({ sub: 'u_abc12345', typ: 'duoorb-guest', exp: 99999999999 })
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(verifyGuestAccessToken(`${head}.${body}.`, [SECRET])).toBeNull();
  });

  it('rejects a Supabase-style account JWT (no guest typ claim)', () => {
    const accountish = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'uuid', role: 'authenticated' })).toString('base64url'),
      'notarealsignature',
    ].join('.');
    expect(verifyGuestAccessToken(accountish, [SECRET])).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', 'x', 'a.b', 'a.b.c.d', '...', 'not-a-token']) {
      expect(verifyGuestAccessToken(bad, [SECRET])).toBeNull();
    }
  });
});

describe('refresh tokens', () => {
  it('are high entropy and url-safe', () => {
    const t = newRefreshToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('are not guessable from one another', () => {
    const set = new Set(Array.from({ length: 200 }, () => newRefreshToken()));
    expect(set.size).toBe(200);
  });

  it('hash deterministically so the raw token is never stored', () => {
    const token = newRefreshToken();
    expect(sha256(token)).toBe(sha256(token));
    expect(sha256(token)).not.toContain(token);
  });
});

describe('opaque token', () => {
  it('produces distinct url-safe values', () => {
    const a = newOpaqueToken();
    const b = newOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
