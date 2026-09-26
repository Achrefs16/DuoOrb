/**
 * One place to decide what name to show for a person.
 *
 * The app used to resolve this per screen and got it wrong each time:
 * `displayName || username` in the friend list, a bare `displayName` in the
 * game HUD, and `'P'` in the game-over modal. A player with an empty
 * displayName therefore appeared under three different renderings depending on
 * which screen you were looking at, which read as "the app has many sources of
 * truth".
 *
 * The server now treats `username` as the canonical display name (it is
 * unique, user-chosen, and never auto-generated), but records and legacy rows
 * can still carry only a displayName — so the fallback chain lives here rather
 * than being re-invented at every call site.
 */
export const FALLBACK_INITIAL = '?';

/** Anything that might carry a name, in descending order of authority. */
export interface NamedLike {
  username?: string | null;
  displayName?: string | null;
}

function clean(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolves a display name from any set of candidates. Later arguments are
 * progressively weaker fallbacks, so callers can pass the richest object
 * first and a plain string last.
 */
export function resolveName(
  ...candidates: (NamedLike | string | null | undefined)[]
): string {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === 'string') {
      const value = clean(candidate);
      if (value) return value;
      continue;
    }
    const value = clean(candidate.username) ?? clean(candidate.displayName);
    if (value) return value;
  }
  return FALLBACK_INITIAL;
}

/** First letter for an avatar bubble. Never returns an empty string. */
export function nameInitial(
  source: NamedLike | string | null | undefined
): string {
  return resolveName(source).charAt(0).toUpperCase() || FALLBACK_INITIAL;
}
