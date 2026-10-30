import { createInitialState, GameMode, GameState, RecordedAction } from '@duoorb/game-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type LanguageCode, isLanguageCode } from '../i18n';
import { isSideChoice } from '../lib/sideChoice';
import { type OrbPaletteId, parseOrbPaletteId, setOrbPaletteId } from '../theme/orbTheme';
import { api } from '../network/apiClient';

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
  /**
   * Seat the replay should be viewed from. For AI games this is the human;
   * for spectator profile views the app overwrites it with the profile
   * owner; for pass-and-play it stays null (default seat 1).
   */
  perspectivePlayerId?: string | null;
  /** True only when the viewer occupied a seat in this game. */
  isViewerSeated?: boolean;
  endedReason?: string;
  timeControlMinutes?: number;
  incrementSeconds?: number;
  botId?: string;
  botName?: string;
  botRating?: number;
  totalMoves: number;
  durationSeconds: number;
  initialState: GameState;
  history: RecordedAction[];
}

const STORAGE_KEY_HISTORY = '@duoorb:history:v1';
const STORAGE_KEY_SETTINGS = '@duoorb:settings:v1';
const STORAGE_KEY_FRIENDS = '@duoorb:friends:v1';
const STORAGE_KEY_BOT_STARS = '@duoorb:bot-stars:v1';
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

/** 0 = not yet defeated, 3 = the clean mastery win. */
export type BotStarCount = 0 | 1 | 2 | 3;

export interface BotStarRecord {
  botKey: string;
  stars: BotStarCount;
  wins: number;
  bestMarginSteps: number;
  updatedAt: string;
}

export type BotStarMap = Record<string, BotStarRecord>;

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
  /** Board skin id: 'classic' free, 'tactile', 'tactileDark', 'stone'. */
  boardSkinId: 'classic' | 'tactile' | 'tactileDark' | 'stone';
  /** Ball / Orb skin id (e.g. 'classic', 'infernal_dragon', 'clockwork', etc.). */
  ballSkinId?: string;
  /** Wall skin id (e.g. 'classic', 'cyber_pulse', 'golden_labyrinth', etc.). */
  wallSkinId?: string;
  /** Player ball / orb color palette. */
  orbPaletteId: OrbPaletteId;
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
  boardSkinId: 'tactile',
  ballSkinId: 'classic',
  wallSkinId: 'classic',
  orbPaletteId: 'classic',
  darkMode: false,
};

// In-memory cache
let inMemoryHistory: SavedGameRecord[] = [];
let inMemorySettings: UserSettings = { ...DEFAULT_SETTINGS };
let inMemoryFriends: Friend[] = [];
let inMemoryBotStars: BotStarMap = {};
let friendsLoaded = false;
let botStarsLoaded = false;

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
      const parsed: any[] = JSON.parse(raw);
      inMemoryHistory = (parsed || []).map((game: any) => {
        if (!game.initialState) {
          game.initialState = createInitialState({
            gameId: game.id || `game-${game.date || Date.now()}`,
            mode: game.mode || '2p',
            playerNames: [game.winnerName || 'Player 1', 'Player 2'],
          });
        }
        if (game.isViewerSeated === undefined) {
          game.isViewerSeated = game.type === 'ai' && Boolean(game.myPlayerId);
        }
        if (game.perspectivePlayerId === undefined) {
          game.perspectivePlayerId = game.myPlayerId ?? null;
        }
        return game as SavedGameRecord;
      });
      inMemoryHistory.sort((a, b) => b.date - a.date);
    }
  } catch (e) {
    console.error('Failed to load game history', e);
  }
  return inMemoryHistory;
}

function isBotStarCount(value: unknown): value is BotStarCount {
  return value === 1 || value === 2 || value === 3;
}

function parseBotStars(raw: string | null): BotStarMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: BotStarMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const record = value as Partial<BotStarRecord>;
      if (!isBotStarCount(record.stars)) continue;
      out[key] = {
        botKey: typeof record.botKey === 'string' ? record.botKey : key,
        stars: record.stars,
        wins:
          typeof record.wins === 'number' && Number.isFinite(record.wins)
            ? Math.max(0, Math.floor(record.wins))
            : 0,
        bestMarginSteps:
          typeof record.bestMarginSteps === 'number' && Number.isFinite(record.bestMarginSteps)
            ? Math.max(0, Math.floor(record.bestMarginSteps))
            : 0,
        updatedAt:
          typeof record.updatedAt === 'string'
            ? record.updatedAt
            : typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
              ? new Date(record.updatedAt).toISOString()
              : '',
      };
    }
    return out;
  } catch {
    return {};
  }
}

/** Bot mastery records, keyed by personality id (or `difficulty:<tier>`). */
export async function loadBotStars(): Promise<BotStarMap> {
  if (botStarsLoaded) return inMemoryBotStars;
  await hydrateNativeCache([STORAGE_KEY_BOT_STARS]);
  inMemoryBotStars = parseBotStars(storage.getItem(STORAGE_KEY_BOT_STARS));
  botStarsLoaded = true;
  return inMemoryBotStars;
}

/** Merges two BotStarMap instances monotonically (best stars, highest wins, max margin). */
export function mergeBotStarsMaps(local: BotStarMap, remote: BotStarMap): BotStarMap {
  const merged: BotStarMap = { ...local };
  for (const [key, rem] of Object.entries(remote)) {
    if (!rem || typeof rem !== 'object') continue;
    const loc = merged[key];
    const stars = Math.max(loc?.stars ?? 0, rem.stars ?? 0);
    if (!isBotStarCount(stars)) continue;
    merged[key] = {
      botKey: rem.botKey || key,
      stars,
      wins: Math.max(
        loc?.wins ?? 0,
        typeof rem.wins === 'number' && Number.isFinite(rem.wins) ? Math.max(0, Math.floor(rem.wins)) : 0
      ),
      bestMarginSteps: Math.max(
        loc?.bestMarginSteps ?? 0,
        typeof rem.bestMarginSteps === 'number' && Number.isFinite(rem.bestMarginSteps)
          ? Math.max(0, Math.floor(rem.bestMarginSteps))
          : 0
      ),
      updatedAt:
        rem.updatedAt && (!loc?.updatedAt || rem.updatedAt > loc.updatedAt)
          ? rem.updatedAt
          : loc?.updatedAt || new Date().toISOString(),
    };
  }
  return merged;
}

/** Ingests bot mastery records returned by the server (e.g. from /api/me or sync). */
export async function ingestServerBotStars(serverBotStars: BotStarMap | undefined | null): Promise<BotStarMap> {
  if (!serverBotStars || typeof serverBotStars !== 'object') return loadBotStars();
  const current = await loadBotStars();
  const merged = mergeBotStarsMaps(current, serverBotStars);
  inMemoryBotStars = merged;
  try {
    storage.setItem(STORAGE_KEY_BOT_STARS, JSON.stringify(inMemoryBotStars));
  } catch (e) {
    console.error('Failed to save merged bot stars', e);
  }
  return inMemoryBotStars;
}

/** Synchronizes local bot stars with the server cloud storage. */
export async function syncBotStarsWithBackend(): Promise<BotStarMap> {
  const current = await loadBotStars();
  try {
    const res = await api.syncBotStars(current);
    if (res?.botStars) {
      return await ingestServerBotStars(res.botStars);
    }
  } catch {
    // Offline / guest offline / unreachable: local storage remains intact
  }
  return inMemoryBotStars;
}

/**
 * Records a win and keeps the player's best mastery. More stars are never lost
 * by a later win. `bestMarginSteps` is kept as match metadata; stars are
 * assist-based.
 */
export async function recordBotVictoryStars(
  botKey: string,
  stars: BotStarCount,
  bestMarginSteps: number
): Promise<BotStarRecord> {
  if (!botStarsLoaded) await loadBotStars();
  const previous = inMemoryBotStars[botKey];
  const next: BotStarRecord = {
    botKey,
    stars: previous && previous.stars > stars ? previous.stars : stars,
    wins: (previous?.wins ?? 0) + 1,
    bestMarginSteps: Math.max(previous?.bestMarginSteps ?? 0, Math.max(0, bestMarginSteps)),
    updatedAt: new Date().toISOString(),
  };
  inMemoryBotStars = { ...inMemoryBotStars, [botKey]: next };
  try {
    storage.setItem(STORAGE_KEY_BOT_STARS, JSON.stringify(inMemoryBotStars));
  } catch (e) {
    console.error('Failed to save bot mastery', e);
  }
  // Fire-and-forget cloud sync if online
  syncBotStarsWithBackend().catch(() => {});
  return next;
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
      if (
        inMemorySettings.boardSkinId !== 'tactile' &&
        inMemorySettings.boardSkinId !== 'tactileDark' &&
        inMemorySettings.boardSkinId !== 'stone'
      ) {
        inMemorySettings.boardSkinId = 'classic';
      }
      if (!inMemorySettings.ballSkinId || typeof inMemorySettings.ballSkinId !== 'string') {
        inMemorySettings.ballSkinId = 'classic';
      }
      if (!inMemorySettings.wallSkinId || typeof inMemorySettings.wallSkinId !== 'string') {
        inMemorySettings.wallSkinId = 'classic';
      }
      inMemorySettings.orbPaletteId = parseOrbPaletteId(inMemorySettings.orbPaletteId);
      setOrbPaletteId(inMemorySettings.orbPaletteId);
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
  if (settings.orbPaletteId !== undefined) {
    setOrbPaletteId(settings.orbPaletteId);
  }
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
  if (isSideChoice(r.side)) out.side = r.side;
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
