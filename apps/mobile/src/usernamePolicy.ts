/**
 * Client mirror of the server's public identity policy
 * (apps/server/src/users/username.ts).
 *
 * This exists only so the editor can validate and normalise as the player
 * types without a round-trip. The server re-validates every save and is the
 * authority — never treat a local `ok` as proof a username was accepted.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;
export const DISPLAY_NAME_MAX = 32;

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'duoorb',
  'official',
  'support',
  'system',
  'moderator',
  'mod',
  'root',
  'null',
  'undefined',
  'player',
  'api',
  'me',
]);

export interface PolicyResult {
  ok: boolean;
  value: string;
  error?: string;
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): PolicyResult {
  const value = normalizeUsername(input);

  if (!value) return { ok: false, value, error: 'Enter a username.' };
  if (value.length < USERNAME_MIN) {
    return { ok: false, value, error: `Use at least ${USERNAME_MIN} characters.` };
  }
  if (value.length > USERNAME_MAX) {
    return { ok: false, value, error: `Use at most ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return { ok: false, value, error: 'Use only lowercase letters, numbers and _.' };
  }
  if (RESERVED_USERNAMES.has(value)) {
    return { ok: false, value, error: 'That username is reserved.' };
  }
  return { ok: true, value };
}

export function normalizeDisplayName(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

export function validateDisplayName(input: string): PolicyResult {
  const value = normalizeDisplayName(input);

  if (!value) return { ok: false, value, error: 'Enter a display name.' };
  if (value.length > DISPLAY_NAME_MAX) {
    return { ok: false, value, error: `Use at most ${DISPLAY_NAME_MAX} characters.` };
  }
  return { ok: true, value };
}

/** Strips anything the policy would reject, so typing stays friction-free. */
export function sanitizeUsernameInput(input: string): string {
  return normalizeUsername(input).replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
}

/**
 * True when the handle is still the one the server generated rather than one
 * the player chose.
 *
 * The server seeds `player_` + the first 6 characters of the user id, and the
 * caller knows its own id, so this compares against the exact generated form.
 * A regex would misfire: guest ids start with `u_`, making the generated
 * suffix contain an underscore, while a real name like `player_one` is legal
 * and must not be flagged.
 */
export function isGeneratedUsername(username: string | null | undefined, userId: string): boolean {
  if (!username) return false;
  return username === `player_${userId.slice(0, 6)}`;
}
