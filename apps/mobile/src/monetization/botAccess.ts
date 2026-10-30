import AsyncStorage from '@react-native-async-storage/async-storage';
import { botById, type BotPersonality } from '@duoorb/game-core';

export type BotAccessType = 'ad_unlock' | 'premium_only';

/**
 * 16 Bots that can be permanently unlocked by watching 1 rewarded video ad the first time.
 * Spread across all 4 tiers like Chess.com so players can unlock bots at any skill level.
 * Once unlocked, stays unlocked forever on device with NO ads needed ever again.
 */
export const AD_UNLOCKABLE_BOT_IDS = new Set<string>([
  // Beginner (4)
  'barnaby',
  'martin',
  'finn',
  'pip',
  // Intermediate (6)
  'bram',
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

const AD_UNLOCKED_BOTS_STORAGE_KEY = '@duoorb:ad_unlocked_bots:v1';

let inMemoryAdUnlockedBots: Set<string> = new Set();
let storageLoaded = false;
const listeners = new Set<() => void>();

export async function loadAdUnlockedBots(): Promise<Set<string>> {
  if (storageLoaded) return inMemoryAdUnlockedBots;
  try {
    const raw = await AsyncStorage.getItem(AD_UNLOCKED_BOTS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        inMemoryAdUnlockedBots = new Set(arr);
      }
    }
    storageLoaded = true;
  } catch {
    storageLoaded = true;
  }
  return inMemoryAdUnlockedBots;
}

export function getCachedAdUnlockedBots(): Set<string> {
  return inMemoryAdUnlockedBots;
}

export async function markBotPermanentlyUnlocked(botId: string): Promise<void> {
  inMemoryAdUnlockedBots.add(botId);
  try {
    await AsyncStorage.setItem(
      AD_UNLOCKED_BOTS_STORAGE_KEY,
      JSON.stringify(Array.from(inMemoryAdUnlockedBots))
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
  if (AD_UNLOCKABLE_BOT_IDS.has(botId)) return 'ad_unlock';
  return 'premium_only';
}

/**
 * All bots are locked initially for free players:
 * - 16 bots can be unlocked permanently by watching 1 rewarded video ad.
 * - 23 bots stay locked and require DuoOrb Premium.
 * - Subscribers have all 39 bots unlocked from day 1.
 */
export function isBotLocked(
  bot: BotPersonality | null | undefined,
  isPremium: boolean,
  adUnlockedSet: Set<string> = inMemoryAdUnlockedBots
): boolean {
  if (!bot) return false;
  if (isPremium) return false;
  if (AD_UNLOCKABLE_BOT_IDS.has(bot.id)) {
    return !adUnlockedSet.has(bot.id);
  }
  // All other 23 bots are subscription-only
  return true;
}

export function anyBotLocked(
  botIds: string[],
  isPremium: boolean,
  adUnlockedSet: Set<string> = inMemoryAdUnlockedBots
): boolean {
  if (isPremium) return false;
  return botIds.some((id) => isBotLocked(botById(id), isPremium, adUnlockedSet));
}

// For test suites
export function _resetAdUnlockedBotsForTests(): void {
  inMemoryAdUnlockedBots = new Set();
  storageLoaded = false;
}
