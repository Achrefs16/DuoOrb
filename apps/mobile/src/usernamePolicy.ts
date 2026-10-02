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
export const BIO_MAX = 280;

/**
 * Client mirror of apps/server/src/moderation/profanity.ts (subset for
 * instant feedback). The server re-checks every save and is authoritative.
 */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };
const BLOCKED_SUBSTRINGS = [
  'porn', 'hentai', 'xxx', 'orgasm', 'masturbat', 'blowjob', 'handjob',
  'nigger', 'nigga', 'faggot', 'dyke', 'tranny', 'retard',
  'kike', 'chink', 'gook', 'spic', 'wetback', 'raghead',
  'hitler', 'nazi', 'kkk',
  'rape', 'rapist', 'molest', 'pedophil',
  'fuck', 'shit', 'bitch', 'whore', 'slut', 'cunt', 'dick', 'pussy', 'boob',
];
const BLOCKED_WORDS = new Set(['sex', 'cum', 'fag', 'hoe', 'kkk', 'nsfw']);

function squashed(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

export function containsBlockedText(input: string): boolean {
  const flat = squashed(input);
  if (!flat) return false;
  for (const stem of BLOCKED_SUBSTRINGS) {
    if (flat.includes(stem)) return true;
  }
  const tokens = input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  return tokens.some((t) => BLOCKED_WORDS.has(t));
}

const BLOCKED_MSG = 'That text contains language that is not allowed. Please choose something else.';

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
  if (containsBlockedText(value)) {
    return { ok: false, value, error: BLOCKED_MSG };
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
  if (containsBlockedText(value)) {
    return { ok: false, value, error: BLOCKED_MSG };
  }
  return { ok: true, value };
}

export function validateBio(input: string): PolicyResult {
  const value = input.slice(0, BIO_MAX);
  if (containsBlockedText(value)) {
    return { ok: false, value, error: BLOCKED_MSG };
  }
  return { ok: true, value };
}

export function validateAvatarUrl(input: string): PolicyResult {
  const value = input.trim();
  if (!value) return { ok: true, value };
  if (value.length > 2048) return { ok: false, value, error: 'Avatar URL is too long.' };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return { ok: false, value, error: 'Avatar must be an https URL.' };
  } catch {
    return { ok: false, value, error: 'Avatar must be a valid https URL.' };
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
/**
 * True while the account is still carrying a handle the SERVER generated,
 * or none at all.
 *
 * A missing username counts as generated on purpose: a brand-new guest is
 * handed `player_xxxxxx` by the server and must be offered the username step.
 * Returning false for an absent handle would silently skip it and drop the
 * player into the app with the seeded name.
 */
export function isGeneratedUsername(username: string | null | undefined, userId: string): boolean {
  if (!username) return true;
  return username === `player_${userId.slice(0, 6)}`;
}
