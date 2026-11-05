/**
 * Server-side computer opponents ("backfill bots") are ordinary users in the
 * database. They are told apart purely by this id prefix, which means:
 *   - no schema migration is needed on production,
 *   - the check survives restarts and crash recovery (no in-memory registry),
 *   - the prefix never reaches clients as a flag — it is only used by the
 *     server to drive seats, and to keep bots out of the public ranking.
 */
export const BOT_ID_PREFIX = 'bot_';

export function isBotUserId(userId: string | undefined | null): boolean {
  return typeof userId === 'string' && userId.startsWith(BOT_ID_PREFIX);
}

