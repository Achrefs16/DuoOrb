import AsyncStorage from '@react-native-async-storage/async-storage';
import { botById, type BotPersonality } from '@duoorb/game-core';

export type BotAccessType = 'free' | 'ad_unlock' | 'premium_only';

/**
 * 2 Bots that are 100% free and permanently unlocked for everyone out of the box.
 * They never require watching ads, tokens, or a subscription:
 * - Beginner: Martin (800) — The Friendly Dad
 * - Intermediate: Bram (1300) — The Bricklayer
 */
export const FREE_BOT_IDS = new Set<string>([
  'martin', // Beginner (800)
  'bram',   // Intermediate (1300)
]);

/**
 * 14 Bots that can be permanently unlocked by watching 1 rewarded video ad the first time.
 * Spread across all 4 tiers like Chess.com so players can unlock bots at any skill level.
 * Once unlocked, stays unlocked forever on device with NO ads needed ever again.
 */
export const AD_UNLOCKABLE_BOT_IDS = new Set<string>([
  // Beginner (3)
  'barnaby',
  'finn',
  'pip',
  // Intermediate (5)
  'nelson',
  'mateo',
  'zara',
  'archimedes',
  'vex',
  // Master (4)
  'marcus',
  'gideon',
  'sora',
  'viktor',
  // Grandmaster (2)
  'achref',
  'kenzo',
]);

/**
 * 23 Bots that are exclusive to DuoOrb Premium subscribers.
 */
export const PREMIUM_ONLY_BOT_IDS = new Set<string>([
  // Beginner (5)
  'clara',
  'leo',
  'tariq',
  'ren',
  'elias',
  // Intermediate (7)
  'fiona',
  'dmitri',
  'layla',
  'dante',
  'meiling',
  'amara',
  'jamal',
  // Master (6)
  'samira',
  'torstein',
  'kofi',
  'diego',
  'hassan',
  'jin',
  // Grandmaster (5)
  'sterling',
  'valeria',
  'nexus9',
  'boba',
  'milo',
]);

/**
 * 6 Master & Grandmaster Ad Bots that unlock for 7 days per rewarded ad.
 * After 7 days, players can watch another ad or subscribe to DuoOrb Premium.
 */
export const HIGH_TIER_AD_BOT_IDS = new Set<string>([
  'marcus',
  'gideon',
  'sora',
  'viktor',
  'achref',
  'kenzo',
]);

export const HIGH_TIER_BOT_UNLOCK_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const AD_UNLOCKED_BOTS_STORAGE_KEY = '@duoorb:ad_unlocked_bots:v1';

let inMemoryAdUnlockedBots: Map<string, number> = new Map();
let storageLoaded = false;
const listeners = new Set<() => void>();

export async function loadAdUnlockedBots(): Promise<Set<string>> {
  if (storageLoaded) return getCachedAdUnlockedBots();
  try {
    const raw = await AsyncStorage.getItem(AD_UNLOCKED_BOTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        inMemoryAdUnlockedBots = new Map(parsed.map((id: string) => [id, Date.now()]));
      } else if (typeof parsed === 'object' && parsed !== null) {
        inMemoryAdUnlockedBots = new Map(
          Object.entries(parsed).map(([k, v]) => [k, Number(v) || Date.now()])
        );
      }
    }
    storageLoaded = true;
  } catch {
    storageLoaded = true;
  }
  return getCachedAdUnlockedBots();
}

export function getCachedAdUnlockedBots(): Set<string> {
  const valid = new Set<string>();
  const now = Date.now();
  for (const [botId, timestamp] of inMemoryAdUnlockedBots.entries()) {
    if (HIGH_TIER_AD_BOT_IDS.has(botId)) {
      if (now - timestamp < HIGH_TIER_BOT_UNLOCK_TTL_MS) {
        valid.add(botId);
      }
    } else {
      valid.add(botId);
    }
  }
  return valid;
}

export async function markBotPermanentlyUnlocked(botId: string): Promise<void> {
  inMemoryAdUnlockedBots.set(botId, Date.now());
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of inMemoryAdUnlockedBots.entries()) {
      obj[k] = v;
    }
    await AsyncStorage.setItem(
      AD_UNLOCKED_BOTS_STORAGE_KEY,
      JSON.stringify(obj)
    );
  } catch {}
  notifyListeners();
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

export function subscribeToAdUnlockedBots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getBotAccessType(botId: string): BotAccessType {
  if (FREE_BOT_IDS.has(botId)) return 'free';
  if (AD_UNLOCKABLE_BOT_IDS.has(botId)) return 'ad_unlock';
  return 'premium_only';
}

/**
 * Bot lock status:
 * - 2 Starter bots (Martin in Beginner and Bram in Intermediate) are permanently free for all players (always unlocked, no ads needed).
 * - 8 Beginner/Intermediate bots can be unlocked permanently by watching 1 rewarded video ad.
 * - 6 Master/Grandmaster bots unlock for 7 days per rewarded video ad.
 * - 23 bots stay locked and require DuoOrb Premium.
 * - Subscribers have all 39 bots unlocked from day 1.
 */
export function isBotLocked(
  bot: BotPersonality | null | undefined,
  isPremium: boolean,
  adUnlockedSet?: Set<string>
): boolean {
  if (!bot) return false;
  if (isPremium) return false;
  if (FREE_BOT_IDS.has(bot.id)) return false;
  const set = adUnlockedSet ?? getCachedAdUnlockedBots();
  if (AD_UNLOCKABLE_BOT_IDS.has(bot.id)) {
    return !set.has(bot.id);
  }
  // All other 23 bots are subscription-only
  return true;
}

export function anyBotLocked(
  botIds: string[],
  isPremium: boolean,
  adUnlockedSet?: Set<string>
): boolean {
  if (isPremium) return false;
  const set = adUnlockedSet ?? getCachedAdUnlockedBots();
  return botIds.some((id) => isBotLocked(botById(id), isPremium, set));
}

// For test suites
export function _resetAdUnlockedBotsForTests(): void {
  inMemoryAdUnlockedBots = new Map();
  storageLoaded = false;
}
