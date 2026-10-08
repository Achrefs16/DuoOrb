/**
 * Token freshness for the socket handshake (ONLINE_HEALTH Phase A).
 *
 * Both credential types in DuoOrb are JWTs carrying `exp` (seconds):
 * guest HS256 access tokens (24h TTL) and Supabase JWTs (~1h TTL).
 * The socket presents whatever token it was built with on EVERY (re)connect,
 * so an expired token reconnects into a permanently-unverified socket:
 * connected transport, rejected actions, no recovery until restart.
 *
 * These pure helpers let the transport check expiry BEFORE connecting and
 * refresh first — decoded locally, never verified here (verification is the
 * server's job at handshake).
 */

/** Safety margin: a token dying within this window counts as expired. */
export const TOKEN_FRESHNESS_SKEW_MS = 60_000;

function base64UrlDecode(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    // atob exists on Hermes (device), browsers, and Node (tests) — the only
    // runtimes this module loads in. No buffer polyfill needed: on failure we
    // return null and the caller treats the token as stale (refresh path).
    return atob(padded);
  } catch {
    return null;
  }
}

/** Expiry of a JWT in epoch ms, or null when unreadable (fail-closed: stale). */
export function decodeJwtExpMs(token: string | null | undefined): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = base64UrlDecode(parts[1]);
  if (!payload) return null;
  try {
    const exp = (JSON.parse(payload) as { exp?: unknown }).exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

/** True when the token is present and outlives now + margin. */
export function isTokenFresh(
  token: string | null | undefined,
  nowMs = Date.now(),
  marginMs = TOKEN_FRESHNESS_SKEW_MS
): boolean {
  const exp = decodeJwtExpMs(token);
  if (exp === null) return false;
  return exp > nowMs + marginMs;
}
