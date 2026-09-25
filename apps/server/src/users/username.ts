import { BadRequestException } from '@nestjs/common';

/**
 * Public identity policy.
 *
 * `username` is the shareable @handle (friends add you by it, it resolves
 * on /api/profiles/:userIdOrUsername, and it is DB-unique). `displayName`
 * is the label opponents see in rooms, seats and the HUD — free-form but
 * length-capped and whitespace-collapsed.
 *
 * The mobile client mirrors these rules for instant feedback, but this
 * module is the authority: the client can always be bypassed.
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;
export const DISPLAY_NAME_MAX = 32;
export const BIO_MAX = 280;

/** Handles that would impersonate the product or collide with app routes. */
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

export interface UsernameCheck {
  ok: boolean;
  /** Normalized (trimmed + lowercased) candidate, returned even when invalid. */
  value: string;
  error?: string;
}

/** Lowercases and trims so `  Alex_1 ` and `alex_1` are one identity. */
export function normalizeUsername(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

/**
 * Pure username policy check. Returns a result object rather than throwing
 * so the client-availability endpoint can reuse it.
 */
export function validateUsername(input: unknown): UsernameCheck {
  const value = normalizeUsername(input);

  if (!value) {
    return { ok: false, value, error: 'Enter a username.' };
  }
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

/** Throws BadRequest (400) unless valid; returns the normalized handle. */
export function assertValidUsername(input: unknown): string {
  const result = validateUsername(input);
  if (!result.ok) {
    throw new BadRequestException(result.error ?? 'Invalid username.');
  }
  return result.value;
}

/** Collapses runs of whitespace and enforces the length cap. */
export function normalizeDisplayName(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

export function validateDisplayName(input: unknown): UsernameCheck {
  const value = normalizeDisplayName(input);

  if (!value) {
    return { ok: false, value, error: 'Enter a display name.' };
  }
  if (value.length > DISPLAY_NAME_MAX) {
    return { ok: false, value, error: `Use at most ${DISPLAY_NAME_MAX} characters.` };
  }
  return { ok: true, value };
}

/** Throws BadRequest (400) unless valid; returns the cleaned label. */
export function assertValidDisplayName(input: unknown): string {
  const result = validateDisplayName(input);
  if (!result.ok) {
    throw new BadRequestException(result.error ?? 'Invalid display name.');
  }
  return result.value;
}
