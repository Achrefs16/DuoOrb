/**
 * Single source of truth for failure taxonomy (mobile + server contract).
 *
 * Every failure is one Kind, detected one way, with one retry answer:
 * retryable kinds get a retry affordance, terminal kinds get a message.
 * Nothing here fabricates success: unknown states stay unknown, and callers
 * — never this layer — decide what the user sees.
 */

export type ErrorKind =
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'AUTH'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE'
  | 'SERVER'
  | 'PARSE'
  | 'UNKNOWN';

/** Transport never completed: no request reached the server (or it timed out). */
export class NetworkError extends Error {
  readonly kind: 'OFFLINE' | 'TIMEOUT';

  constructor(kind: 'OFFLINE' | 'TIMEOUT', message?: string) {
    super(message ?? (kind === 'TIMEOUT' ? 'Request timed out.' : 'Network request failed.'));
    this.name = 'NetworkError';
    this.kind = kind;
  }
}

/**
 * The server answered with an error. Carries the HTTP status plus the
 * machine-readable contract the server filter stamps on every error body:
 * `code`, `retryable`, and `retryAfterMs` for rate limits.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    status: number,
    opts: { code?: string; retryable?: boolean; retryAfterMs?: number } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = opts.code;
    this.retryAfterMs =
      typeof opts.retryAfterMs === 'number' ? opts.retryAfterMs : undefined;
    this.retryable =
      typeof opts.retryable === 'boolean'
        ? opts.retryable
        : status >= 500 || status === 429 || opts.code === 'RATE_LIMIT';
  }
}

export function kindOf(e: unknown): ErrorKind {
  if (e instanceof NetworkError) return e.kind;
  if (e instanceof ApiError) {
    if (e.code === 'PARSE') return 'PARSE';
    if (e.code === 'RATE_LIMIT' || e.status === 429) return 'RATE';
    if (e.status === 401 || e.status === 403) return 'AUTH';
    if (e.status === 400) return 'VALIDATION';
    if (e.status === 409) return 'CONFLICT';
    if (e.status >= 500) return 'SERVER';
    return 'UNKNOWN';
  }
  return 'UNKNOWN';
}

/** Retry affordance iff the kind is retryable. Callers decide the UI. */
export function isRetryable(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  if (e instanceof ApiError) return e.retryable;
  return false;
}

/**
 * Prod logging seam (Sentry later). SERVER/PARSE only — OFFLINE, validation,
 * conflicts, rate limits and auth failures are user states, not bugs, and
 * are never reported.
 */
export function reportError(e: unknown, context: string): void {
  const kind = kindOf(e);
  if (kind !== 'SERVER' && kind !== 'PARSE') return;
  if (__DEV__) {
    console.warn(`[${kind}:${context}]`, e);
  }
}

/** Exact user-facing copy. Screens and banners read these, never invent text. */
export const COPY = {
  offlineBanner: "You're offline — showing saved games.",
  serverBanner: "Can't reach DuoOrb servers — retrying…",
  screenOfflineTitle: "You're offline",
  screenOfflineSub: 'Check connection',
  screenServerTitle: 'Something broke on our side',
  actionRetry: "Couldn't save — tap to retry",
  sessionExpired: 'Session expired, sign in again.',
} as const;

/** "Too many tries, wait Xs." — seconds from the server when provided. */
export function rateMessage(e: unknown): string {
  const s =
    e instanceof ApiError && typeof e.retryAfterMs === 'number'
      ? Math.max(1, Math.ceil(e.retryAfterMs / 1000))
      : undefined;
  return s ? `Too many tries, wait ${s}s.` : 'Too many tries, try again soon.';
}

/**
 * Toast text for a failed tap action. Server refusals (validation, conflict,
 * auth, rate) speak with the server's reason; transport/server failures get
 * the generic retry line. The list on screen never changes.
 */
export function actionMessage(e: unknown): string {
  const kind = kindOf(e);
  if (kind === 'RATE') return rateMessage(e);
  if (kind === 'AUTH') return COPY.sessionExpired;
  if (
    e instanceof ApiError &&
    e.message &&
    (kind === 'VALIDATION' || kind === 'CONFLICT')
  ) {
    return e.message;
  }
  return COPY.actionRetry;
}

/**
 * Sub-message for a failed screen load. Undefined means "let ErrorState
 * speak for the kind" (offline/server titles). Server refusals carry their
 * own reason.
 */
export function loadMessage(e: unknown): string | undefined {
  const kind = kindOf(e);
  if (kind === 'RATE') return rateMessage(e);
  if (kind === 'AUTH') return COPY.sessionExpired;
  if (
    e instanceof ApiError &&
    e.message &&
    (kind === 'VALIDATION' || kind === 'CONFLICT')
  ) {
    return e.message;
  }
  return undefined;
}
