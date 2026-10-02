/**
 * Shared UGC text safety (Play UGC moderation requirement).
 *
 * Server-authoritative: the mobile client mirrors the same rules for instant
 * feedback, but every save is re-checked here. Human review of Reports is
 * still the backstop — this filter catches the obvious cases at write time.
 *
 * Matching is deliberately conservative: normalized (lowercase, leet-folded,
 * non-alphanumerics stripped) substring for stems >= 4 chars, exact-token
 * match for short words so innocent names are never blocked.
 */

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's' };

/** Long stems: matched as substrings after normalization. */
const BLOCKED_SUBSTRINGS = [
  'porn', 'hentai', 'xxx', 'orgasm', 'masturbat', 'blowjob', 'handjob',
  'nigger', 'nigga', 'faggot', 'dyke', 'tranny', 'retard',
  'kike', 'chink', 'gook', 'spic', 'wetback', 'raghead',
  'hitler', 'nazi', 'kkk', 'jihadist',
  'kill yourself', 'kys',
  'rape', 'rapist', 'molest', 'pedophil', 'childporn',
  'bestiality', 'necrophil',
  'fuck', 'shit', 'bitch', 'whore', 'slut', 'cunt', 'dick', 'pussy', 'boob',
];

/** Short words: matched as whole tokens only (avoids false positives). */
const BLOCKED_WORDS = new Set(['sex', 'cum', 'fag', 'hoe', 'jiz', 'kkk', 'ss', 'nsfw']);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function squashed(text: string): string {
  return normalize(text).replace(/[^a-z0-9]/g, '');
}

export function containsProfanity(input: unknown): boolean {
  if (typeof input !== 'string' || !input.trim()) return false;
  const flat = squashed(input);
  if (!flat) return false;
  for (const stem of BLOCKED_SUBSTRINGS) {
    if (stem.length >= 4) {
      if (flat.includes(stem.replace(/[^a-z0-9]/g, ''))) return true;
    }
  }
  const tokens = normalize(input).split(' ').filter(Boolean);
  for (const t of tokens) {
    if (BLOCKED_WORDS.has(t)) return true;
  }
  return false;
}

export function cleanTextError(input: unknown): string | null {
  if (containsProfanity(input)) {
    return 'That text contains language that is not allowed. Please choose something else.';
  }
  return null;
}

/**
 * Avatar URLs must be plain https links (or empty to clear). Rejects
 * javascript:/data:/blob: schemes, credentials in the URL, and overlong
 * values. Any https host is allowed (Google, Supabase, etc.).
 */
export function avatarUrlError(input: unknown): string | null {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input !== 'string') return 'Avatar must be a URL.';
  if (input.length > 2048) return 'Avatar URL is too long.';
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return 'Avatar must be a valid https URL.';
  }
  if (url.protocol !== 'https:') return 'Avatar must be an https URL.';
  if (url.username || url.password) return 'Avatar URL must not contain credentials.';
  return null;
}
