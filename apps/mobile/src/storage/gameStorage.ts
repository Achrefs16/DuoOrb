import { GameMode, GameState, RecordedAction } from '@duoorb/game-core';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedGameRecord {
  id: string;
  date: number;
  mode: GameMode;
  type: 'local' | 'ai' | 'online';
  aiDifficulty?: string;
  winnerId: string | null;
  winnerName: string;
  /**
   * The device player's seat id for AI games (null for local pass-and-play,
   * which has no single "you"). Win/loss is decided by comparing this to
   * winnerId — never by matching display names, which breaks the moment the
   * player sets a real name instead of the default 'You'.
   */
  myPlayerId?: string | null;
  totalMoves: number;
  durationSeconds: number;
  initialState: GameState;
  history: RecordedAction[];
}

const STORAGE_KEY_HISTORY = '@duoorb:history:v1';
const STORAGE_KEY_SETTINGS = '@duoorb:settings:v1';
const STORAGE_KEY_FRIENDS = '@duoorb:friends:v1';
const STORAGE_KEY_ONLINE_SNAPSHOT_PREFIX = '@duoorb:online-snapshot:v1:';

export interface OnlineGameSnapshot {
  gameId: string;
  state: GameState;
  clocks: Record<string, number>;
  myPlayerId: string | null;
  myPlayerIndex: number;
  savedAt: number;
}

export interface Friend {
  id: string;
  name: string;
  addedAt: number;
}

export interface UserSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  timeControlMinutes: number; // 0 = no clock, 3, 5, 10
  aiDifficulty: 'easy' | 'normal' | 'hard';
  /** Per-move Fischer increment: +N sec after every move when the clock has one. */
  incrementEnabled: boolean;
  /** Queue moves while the AI or your online opponent is thinking (chess.com-style premove). */
  premoveEnabled: boolean;
  /** Chain several premoves and wall pre-drops in a row. */
  extendedQueue: boolean;
  /** Long 10s AI pause, for testing premoves. */
  testThink: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  timeControlMinutes: 3,
  aiDifficulty: 'normal',
  incrementEnabled: true,
  // Premove is opt-in. Queuing a move for your opponent's turn is a
  // power-user affordance and confusing when you have not asked for it, so it
  // starts off and is enabled explicitly in Settings.
  premoveEnabled: false,
  extendedQueue: true,
  testThink: false,
};

// In-memory cache
let inMemoryHistory: SavedGameRecord[] = [];
let inMemorySettings: UserSettings = { ...DEFAULT_SETTINGS };
let inMemoryFriends: Friend[] = [];
let friendsLoaded = false;

/**
 * Universal storage access (Web + native).
 *
 * This was web-only: on Android there is no `window.localStorage`, so
 * getItem always returned null and setItem silently did nothing. Every setting
 * therefore reset to its default on relaunch, and saved game history and
 * online snapshots were lost the same way. Reads now fall back to AsyncStorage
 * on native, with the in-memory cache covering the synchronous accessors.
 *
 * The sync `getItem`/`setItem` signatures are kept because some callers read
 * during render; on native they are served from the in-memory cache, which
 * `loadSettings`/`loadGameHistory` prime from AsyncStorage at startup.
 */
const hasWebStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

const storage = {
  getItem: (key: string): string | null => {
    if (hasWebStorage()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // ignore
      }
    }
    return syncNativeCache[key] ?? null;
  },
  setItem: (key: string, value: string): void => {
    syncNativeCache[key] = value;
    if (hasWebStorage()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // ignore
      }
    }
    // Fire-and-forget: keep writing to the real device store natively.
    void AsyncStorage.setItem(key, value).catch(() => {});
  },
  removeItem: (key: string): void => {
    delete syncNativeCache[key];
    if (hasWebStorage()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        // ignore
      }
    }
    void AsyncStorage.removeItem(key).catch(() => {});
  },
};

/**
 * Synchronous view of the native store, populated by the `load*` helpers.
 * Lets render-time reads work without making every accessor async.
 */
const syncNativeCache: Record<string, string> = {};

/** Pulls the given keys from AsyncStorage into the sync cache (native only). */
async function hydrateNativeCache(keys: string[]): Promise<void> {
  if (hasWebStorage()) return;
  try {
    const entries = await AsyncStorage.multiGet(keys);
    for (const [key, value] of entries) {
      if (value !== null) syncNativeCache[key] = value;
    }
  } catch {
    // ignore
  }
}

export async function saveGameToHistory(game: SavedGameRecord): Promise<void> {
  inMemoryHistory.unshift(game);
  if (inMemoryHistory.length > 50) {
    inMemoryHistory = inMemoryHistory.slice(0, 50); // Keep 50 recent games
  }
  inMemoryHistory.sort((a, b) => b.date - a.date);
  try {
    storage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(inMemoryHistory));
  } catch (e) {
    console.error('Failed to save game to storage', e);
  }
}

export async function loadGameHistory(): Promise<SavedGameRecord[]> {
  await hydrateNativeCache([STORAGE_KEY_HISTORY]);
  try {
    const raw = storage.getItem(STORAGE_KEY_HISTORY);
    if (raw) {
      inMemoryHistory = JSON.parse(raw);
      inMemoryHistory.sort((a, b) => b.date - a.date);
    }
  } catch (e) {
    console.error('Failed to load game history', e);
  }
  return inMemoryHistory;
}

export async function saveOnlineGameSnapshot(snapshot: OnlineGameSnapshot): Promise<void> {
  try {
    storage.setItem(`${STORAGE_KEY_ONLINE_SNAPSHOT_PREFIX}${snapshot.gameId}`, JSON.stringify(snapshot));
  } catch (e) {
    console.error('Failed to save online game snapshot', e);
  }
}

export async function loadOnlineGameSnapshot(gameId: string): Promise<OnlineGameSnapshot | null> {
  await hydrateNativeCache([`${STORAGE_KEY_ONLINE_SNAPSHOT_PREFIX}${gameId}`]);
  try {
    const raw = storage.getItem(`${STORAGE_KEY_ONLINE_SNAPSHOT_PREFIX}${gameId}`);
    if (!raw) return null;
    return JSON.parse(raw) as OnlineGameSnapshot;
  } catch (e) {
    console.error('Failed to load online game snapshot', e);
    return null;
  }
}

export async function loadSettings(): Promise<UserSettings> {
  // Pull from the device store first: on native the sync accessor is served
  // from the cache this fills, and without it every setting read as its default.
  await hydrateNativeCache([STORAGE_KEY_SETTINGS]);
  try {
    const raw = storage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      inMemorySettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return inMemorySettings;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  inMemorySettings = { ...inMemorySettings, ...settings };
  try {
    storage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(inMemorySettings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
  return inMemorySettings;
}

function persistFriends(): void {
  try {
    storage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(inMemoryFriends));
  } catch (e) {
    console.error('Failed to save friends', e);
  }
}

export async function loadFriends(): Promise<Friend[]> {
  if (!friendsLoaded) {
    await hydrateNativeCache([STORAGE_KEY_FRIENDS]);
    try {
      const raw = storage.getItem(STORAGE_KEY_FRIENDS);
      if (raw) inMemoryFriends = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to load friends', e);
    }
    friendsLoaded = true;
  }
  return inMemoryFriends;
}

export async function addFriend(name: string): Promise<Friend[]> {
  const trimmed = name.trim().slice(0, 24);
  if (!trimmed) return inMemoryFriends;
  inMemoryFriends = [
    ...inMemoryFriends,
    { id: `friend-${Date.now()}`, name: trimmed, addedAt: Date.now() },
  ];
  persistFriends();
  return inMemoryFriends;
}

export async function removeFriend(id: string): Promise<Friend[]> {
  inMemoryFriends = inMemoryFriends.filter((f) => f.id !== id);
  persistFriends();
  return inMemoryFriends;
}

const STORAGE_KEY_LINK_NUDGE_COUNT = '@duoorb:link-nudge-count:v1';
const STORAGE_KEY_LINK_NUDGE_SHOWN = '@duoorb:link-nudge:v1';

/**
 * Completed-game counter driving the one-time Google-link nudge. Guests only:
 * callers check the session before reading this. Best-effort like the rest
 * of this file — a failed write simply skips the nudge.
 */
export async function recordCompletedGame(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LINK_NUDGE_COUNT);
    const next = (raw ? Number.parseInt(raw, 10) || 0 : 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEY_LINK_NUDGE_COUNT, String(next));
    return next;
  } catch {
    return 0;
  }
}

/** True once the link nudge has been shown: it fires exactly once. */
export async function hasShownLinkNudge(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY_LINK_NUDGE_SHOWN)) === '1';
  } catch {
    // Unreadable store: never nag.
    return true;
  }
}

export async function markLinkNudgeShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LINK_NUDGE_SHOWN, '1');
  } catch {
    // Best-effort: worst case the nudge repeats at the next milestone.
  }
}
