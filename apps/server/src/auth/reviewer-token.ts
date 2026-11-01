import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ReviewerAccessClaims {
  sub: string;
  email: string;
  role: 'reviewer';
  displayName: string;
  iat: number;
  exp: number;
  jti: string;
  typ: 'duoorb-reviewer';
}

const HEADER = { alg: 'HS256', typ: 'JWT' };

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(seg: string): Buffer {
  const pad = seg.length % 4 === 0 ? '' : '='.repeat(4 - (seg.length % 4));
  return Buffer.from(seg.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function newOpaqueToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

function signature(data: string, secret: Buffer): string {
  return b64url(createHmac('sha256', secret).update(data).digest());
}

/**
 * Signs an HS256 JWT access token for a Google Play reviewer.
 * Default validity: 180 days (generous enough for review cycles without unexpected logouts).
 */
export function signReviewerAccessToken(
  userId: string,
  email: string,
  displayName: string,
  secret: Buffer,
  ttlSeconds = 180 * 24 * 60 * 60,
  now = Date.now()
): { token: string; expiresAt: Date } {
  const iat = Math.floor(now / 1000);
  const exp = iat + ttlSeconds;
  const payload: ReviewerAccessClaims = {
    sub: userId,
    email,
    role: 'reviewer',
    displayName,
    iat,
    exp,
    jti: newOpaqueToken(12),
    typ: 'duoorb-reviewer',
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
 * Verifies a reviewer access token synchronously against the configured secrets.
 */
export function verifyReviewerAccessToken(
  token: string,
  secrets: Buffer[],
  now = Date.now()
): ReviewerAccessClaims | null {
  if (!token || secrets.length === 0) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;

  let data: string;
  try {
    const header = JSON.parse(b64urlDecode(head).toString('utf8'));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') return null;
    data = `${head}.${body}`;
  } catch {
    return null;
  }

  const provided = Buffer.from(sig);
  let ok = false;
  for (const secret of secrets) {
    const expected = Buffer.from(signature(data, secret));
    if (expected.length !== provided.length) continue;
    if (timingSafeEqual(expected, provided)) {
      ok = true;
      break;
    }
  }
  if (!ok) return null;

  try {
    const claims = JSON.parse(b64urlDecode(body).toString('utf8'));
    if (claims?.typ !== 'duoorb-reviewer') return null;
    if (claims?.role !== 'reviewer') return null;
    if (typeof claims.sub !== 'string' || !claims.sub) return null;
    if (typeof claims.email !== 'string' || !claims.email) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) return null;
    return claims as ReviewerAccessClaims;
  } catch {
    return null;
  }
}

