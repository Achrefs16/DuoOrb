import { GameMode, GameState, RecordedAction } from '@duoorb/game-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type LanguageCode, isLanguageCode } from '../i18n';

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
const STORAGE_KEY_MATCH_SETUP_PREFIX = '@duoorb:match-setup:v1:';

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
  /** Board surface palette: 'light' free, 'midnight' free in dark mode. */
  themeName: 'light' | 'midnight';
  /** Premium board skin id: 'classic' free, walnut premium. */
  boardSkinId: 'classic' | 'walnut';
  /** App-wide dark mode. Device flag, independent of the board theme. */
  darkMode: boolean;
  /** App language code. */
  language: LanguageCode;
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  soundEnabled: true,
  timeControlMinutes: 3,
  aiDifficulty: 'normal',
  incrementEnabled: true,
  // Premove is opt-in. Queuing a move for your opponent's turn is a
  // power-user affordance and confusing when you have not asked for it, so it
  // starts off and is enabled explicitly in Settings.
  premoveEnabled: false,
  extendedQueue: true,
  testThink: false,
  themeName: 'light',
  boardSkinId: 'classic',
  darkMode: false,
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
      // Drop the retired haptics flag from older installs: no vibration code
      // ever read it, so keeping it would only preserve a dead key.
      delete (inMemorySettings as Partial<UserSettings> & { hapticsEnabled?: boolean }).hapticsEnabled;
      // Whitelist the board theme (E23): an unknown value (downgrade, corrupt
      // store) falls back to light instead of breaking the board renderer.
      if (inMemorySettings.themeName !== 'midnight') {
        inMemorySettings.themeName = 'light';
      }
      // Whitelist the board skin the same way: unknown ids (downgrade,
      // corrupt store) fall back to classic instead of breaking the board.
      if (inMemorySettings.boardSkinId !== 'walnut') {
        inMemorySettings.boardSkinId = 'classic';
      }
      // Coerce the appearance flag the same way: anything truthy-but-not-true
      // (downgrade, corrupt store) falls back to light mode.
      inMemorySettings.darkMode = inMemorySettings.darkMode === true;
      if (!isLanguageCode(inMemorySettings.language)) {
        inMemorySettings.language = 'en';
      }
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

/** Last-used match setup, per entry kind. Everything optional: the screen
 *  falls back to its defaults for anything missing or invalid. */
export interface MatchSetupDraft {
  mode?: string;
  playerCount?: number;
  difficulty?: string;
  botId?: string | null;
  side?: string;
  wallsEach?: number;
  clockId?: string;
}

export const MATCH_SETUP_KINDS = ['ai', 'local', 'challenge', 'online'] as const;

/** Unknown values (downgrade, corrupt store) are dropped, never applied. */
export function sanitizeMatchSetupDraft(raw: unknown): MatchSetupDraft {
  const out: MatchSetupDraft = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (r.mode === 'classic' || r.mode === 'center' || r.mode === 'race') out.mode = r.mode;
  if (r.playerCount === 2 || r.playerCount === 3 || r.playerCount === 4) out.playerCount = r.playerCount;
  if (r.difficulty === 'easy' || r.difficulty === 'normal' || r.difficulty === 'hard') {
    out.difficulty = r.difficulty;
  }
  if (typeof r.botId === 'string' || r.botId === null) out.botId = r.botId;
  if (r.side === 'blue' || r.side === 'red' || r.side === 'random') out.side = r.side;
  if (r.wallsEach === 10 || r.wallsEach === 15 || r.wallsEach === 99) out.wallsEach = r.wallsEach;
  if (typeof r.clockId === 'string' && r.clockId.length > 0) out.clockId = r.clockId;
  return out;
}

/** Sync read: boot-hydrated on native, localStorage on web. */
export function getMatchSetupDraft(kind: string): MatchSetupDraft {
  try {
    const raw = storage.getItem(`${STORAGE_KEY_MATCH_SETUP_PREFIX}${kind}`);
    if (!raw) return {};
    return sanitizeMatchSetupDraft(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveMatchSetupDraft(kind: string, draft: MatchSetupDraft): void {
  try {
    storage.setItem(`${STORAGE_KEY_MATCH_SETUP_PREFIX}${kind}`, JSON.stringify(draft));
  } catch (e) {
    console.error('Failed to save match setup draft', e);
  }
}

/** Primes the sync cache on native so the setup screen reads instantly. */
export async function hydrateMatchSetupDrafts(): Promise<void> {
  await hydrateNativeCache(MATCH_SETUP_KINDS.map((k) => `${STORAGE_KEY_MATCH_SETUP_PREFIX}${k}`));
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
