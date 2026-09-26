import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HS256 JWT implementation, done synchronously on purpose.
 *
 * The socket gateway must be able to authenticate a handshake without an
 * `await` (see the note in game.gateway.ts: mutations arriving in the first
 * milliseconds after connect must not be rejected). Supabase JWKS verification
 * is a network round trip, so it cannot serve that path; a locally computed
 * HMAC can.
 */

export interface GuestAccessClaims {
  /** The guest's user id — the same string the account would use. */
  sub: string;
  exp: number;
  iat: number;
  /**
   * Unique token id. Without it, two tokens minted in the same second would be
   * byte-identical (iat/exp have one-second resolution), so "a new token" would
   * not actually be new. Also the hook a future denylist would key on.
   */
  jti: string;
  /** Marks this as one of ours so account JWTs are never mistaken for it. */
  typ: 'duoorb-guest';
}

const HEADER = { alg: 'HS256', typ: 'JWT' };

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(seg: string): Buffer {
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
  return Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newRefreshToken(): string {
  return b64url(randomBytes(32));
}

/** Opaque, high-entropy, url-safe. Only ever stored hashed. */
export function newOpaqueToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

function signature(data: string, secret: Buffer): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

export function signGuestAccessToken(
  userId: string,
  secret: Buffer,
  ttlSeconds: number,
  now = Date.now()
): { token: string; expiresAt: Date } {
  const iat = Math.floor(now / 1000);
  const exp = iat + ttlSeconds;
  const payload: GuestAccessClaims = {
    sub: userId,
    iat,
    exp,
    jti: newOpaqueToken(12),
    typ: 'duoorb-guest',
  };
  const head = b64url(Buffer.from(JSON.stringify(HEADER)));
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const data = `${head}.${body}`;
  return {
    token: `${data}.${signature(data, secret)}`,
    expiresAt: new Date(exp * 1000),
  };
}

/**
 * Verifies a guest access token against every configured secret.
 *
 * Synchronous and allocation-light. Returns null for anything that is not a
 * valid, unexpired guest token — including Supabase account JWTs, so callers
 * can fall straight through to their own verification.
 */
export function verifyGuestAccessToken(
  token: string,
  secrets: Buffer[],
  now = Date.now()
): GuestAccessClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;

  let data: string;
  try {
    const header = JSON.parse(b64urlDecode(head).toString('utf8'));
    // Reject anything that is not our own HS256 guest token outright. Without
    // this check an "alg: none" style token would reach the HMAC step.
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;
    data = `${head}.${body}`;
  } catch {
    return null;
  }

  const provided = Buffer.from(sig);
  let ok = false;
  // Every secret is checked so a rotation window does not lock anyone out.
  for (const secret of secrets) {
    const expected = Buffer.from(signature(data, secret));
    if (expected.length !== provided.length) continue;
    if (timingSafeEqual(expected, provided)) {
      ok = true;
    }
  }
  if (!ok) return null;

  try {
    const claims = JSON.parse(b64urlDecode(body).toString('utf8'));
    if (claims?.typ !== 'duoorb-guest') return null;
    if (typeof claims.sub !== 'string' || !claims.sub) return null;
    if (typeof claims.jti !== 'string' || !claims.jti) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
    return claims as GuestAccessClaims;
  } catch {
    return null;
  }
}
