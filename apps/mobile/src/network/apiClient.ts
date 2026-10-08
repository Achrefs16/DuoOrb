import { API_URL } from './config';
import {
  clearIdentity,
  getAccessTokenSync,
  getRefreshToken,
  patchIdentity,
} from './auth';
import { socketManager } from './socket';
import { ApiError, NetworkError } from './errors';
import type { GameReview, GameState, RecordedAction } from '@duoorb/game-core';

// ApiError lives in ./errors (single taxonomy); re-exported here so existing
// `import { ApiError } from '../network/apiClient'` call sites keep working.
export { ApiError, NetworkError } from './errors';

export interface UserRatingDto {
  rating: number;
  rd: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface UserMeDto {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt?: string | number;
  ratings?: Record<string, UserRatingDto>;
  badges?: ProfileBadgesDto;
  /** Premium entitlement (server truth; absent on old servers = free tier). */
  isPremium?: boolean;
  premiumExpiresAt?: string | null;
}

export interface PublicProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt?: string | number;
  ratings?: Record<string, UserRatingDto>;
  badges?: ProfileBadgesDto;
  /** Effective premium flag for the name badge (no expiry date publicly). */
  isPremium?: boolean;
}

/** The raw `Profile` row that PATCH /me/profile resolves to. */
export interface ProfileRowDto {
  id?: string;
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface UsernameAvailabilityDto {
  username: string;
  available: boolean;
}

/** What the server hands back when it creates or refreshes a guest. */
export interface GuestCredentialsDto {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  displayName: string;
  accessExpiresAt: number;
}

export interface FriendItemDto {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  status: 'ONLINE' | 'PLAYING' | 'OFFLINE';
  /** Badge-effective premium (absent on old servers = no badge). */
  isPremium?: boolean;
}

export interface FriendRequestItemDto {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  createdAt: number;
}

export interface LeaderboardEntryDto {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  rating: number;
  rd: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  /** Badge-effective premium (absent on old servers = no badge). */
  isPremium?: boolean;
}

/** One page of the universal board. */
export interface LeaderboardPageDto {
  entries: LeaderboardEntryDto[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Where the caller sits on the board. Guests and unplayed accounts are not
 * ranked (`ranked: false`) — the client shows the link card or the
 * play-to-rank hint, never an error.
 */
export interface MyRankDto {
  ranked: boolean;
  reason?: string;
  rank?: number;
  rating?: number;
  total?: number;
  windowOffset?: number;
  entries?: LeaderboardEntryDto[];
}

export interface RatingHistoryPointDto {
  gameId: string;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  timestamp: string | number;
}

export interface GameHistoryItemDto {
  gameId: string;
  mode: string;
  status: string;
  isRanked: boolean;
  timeControlMinutes: number;
  incrementSeconds: number;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  endedReason?: string;
  endedAt: string | number;
  durationMs: number;
  myRating: {
    before: number | null;
    after: number | null;
    delta: number;
  };
  opponent: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    ratingBefore: number | null;
    ratingAfter: number | null;
  } | null;
}

export interface HistorySummaryDto {
  total: number;
  wins: number;
  losses: number;
}

export interface HistoryResponseDto {
  games: GameHistoryItemDto[];
  total: number;
  summary?: HistorySummaryDto;
}

/** Metal ladder, bronze → diamond. Drives medallion colors. */
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
/** Badge grouping for the achievements section. */
export type BadgeCategory = 'streak' | 'rank' | 'milestone' | 'mastery';

/** Locked-badge progress toward its target (absent when not tracked). */
export interface BadgeProgress {
  current: number;
  target: number;
}

/** One badge with catalog text, as the server returns it. */
export interface BadgeDto {
  code: string;
  name: string;
  description: string;
  /** How to earn it, shown in the badge detail view. */
  requirement: string;
  /** Feather icon name. */
  icon: string;
  tier?: BadgeTier;
  category?: BadgeCategory;
  /** Value that earns it (for progress-capable badges). */
  target?: number;
  /**
   * Shipped in the catalog but not awarded yet (rank ladder while the
   * player base is small). The client shows these as "Coming soon" —
   * visible, never silently missing.
   */
  comingSoon?: boolean;
}

export interface EquippedBadgeDto extends BadgeDto {
  slot: number;
}

export interface ProfileBadgesDto {
  equipped: EquippedBadgeDto[];
  hardWins: number;
  fastestPlies: number | null;
}

export interface AiWinReward {
  win: { id: string; mode: string; totalPlies: number; playedAt: string };
  alreadyRecorded: boolean;
  /** Same winning sequence already stored: counted once, no new rewards. */
  duplicate: boolean;
  newAchievements: BadgeDto[];
  stats: {
    hardWins: number;
    fastestPlies: number | null;
    owners: Record<string, number>;
    speedRank: number | null;
  };
  /** Personalized celebration line. Empty when nothing new was earned. */
  message: string;
}

export interface AiWinListItemDto {
  id: string;
  mode: string;
  totalPlies: number;
  durationSeconds: number;
  playedAt: string;
  createdAt: string;
}

export interface AiWinDetailDto extends AiWinListItemDto {
  userId: string;
  clientWinId: string;
  aiDifficulty: string;
  playerSeat: number;
  movesNotation: string;
}

export interface AchievementsResponseDto {
  earned: (BadgeDto & { earnedAt?: string })[];
  equipped: EquippedBadgeDto[];
  catalog: (BadgeDto & { earned: boolean; progress?: BadgeProgress })[];
  stats: { hardWins: number; fastestPlies: number | null };
  /** Badge owners per code — rarity for detail views. */
  owners: Record<string, number>;
}

export interface SubmitAiWinBody {
  clientWinId: string;
  mode: string;
  aiDifficulty: 'hard';
  playerSeat: number;
  movesNotation: string;
  totalPlies: number;
  durationSeconds: number;
  playedAt: number;
}

export interface HeadToHeadStats {
  totalGames: number;
  myWins: number;
  theirWins: number;
  draws: number;
  myWinRate: number;
  theirWinRate: number;
  lastResult: 'WIN' | 'LOSS' | 'DRAW' | null;
  currentStreak: {
    holder: 'YOU' | 'OPPONENT';
    count: number;
  } | null;
  recentMatches: GameHistoryItemDto[];
}

let activeTokenProvider: (() => Promise<string | null>) | null = null;

export function setTokenProvider(getter: () => Promise<string | null>) {
  activeTokenProvider = getter;
}

/**
 * The bearer for every request, resolved fresh on each call.
 *
 * The provider (the session layer) is asked first because it can refresh an
 * account session; the canonical identity is the fallback. Reading the store
 * rather than a render-time snapshot is what makes a 401-then-retry actually
 * present the NEW token instead of the one that just failed.
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  if (activeTokenProvider) {
    try {
      const token = await activeTokenProvider();
      if (token) return { Authorization: `Bearer ${token}` };
    } catch {
      // fall through to the canonical identity
    }
  }
  const token = getAccessTokenSync();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Asks the server for a guest identity. The device sends nothing it can be
 * trusted about — the server allocates the id, profile, rating and tokens.
 * This is what replaced the old self-minted "dev-" credential.
 */
export async function createGuestSession(): Promise<GuestCredentialsDto> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}/guest`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      15000
    );
  } catch (e) {
    throw toNetworkError(e);
  }
  if (!res.ok) {
    throw await throwHttpError(res, `Could not start a guest session (${res.status})`);
  }
  return parseJson<GuestCredentialsDto>(res);
}

/**
 * Trades the refresh token for a new pair. Both tokens rotate server-side, so
 * the old ones stop working immediately.
 */
export async function refreshGuestSession(
  refreshToken: string
): Promise<GuestCredentialsDto> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${API_URL}/guest/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
      15000
    );
  } catch (e) {
    throw toNetworkError(e);
  }
  if (!res.ok) {
    throw await throwHttpError(res, `Could not refresh the session (${res.status})`);
  }
  return parseJson<GuestCredentialsDto>(res);
}

/**
 * fetch with a hard timeout. Abort maps to TIMEOUT; any other transport
 * failure maps to OFFLINE. Never returns null, never swallows.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw toNetworkError(e);
  } finally {
    clearTimeout(timer);
  }
}

function toNetworkError(e: unknown): NetworkError {
  const name = (e as { name?: string } | null)?.name;
  if (name === 'AbortError') return new NetworkError('TIMEOUT');
  if (e instanceof TypeError) return new NetworkError('OFFLINE', e.message);
  if (e instanceof NetworkError) return e;
  return new NetworkError('OFFLINE', e instanceof Error ? e.message : undefined);
}

/** Builds the contract error from a non-2xx response (code/retryable parsed). */
async function throwHttpError(res: Response, fallback: string): Promise<ApiError> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    return new ApiError(fallback, res.status, { retryable: res.status >= 500 });
  }
  // Nest sends `message` as a string or an array of validation errors.
  const raw = body?.message;
  const msg = Array.isArray(raw) ? raw[0] : raw || fallback;
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const retryAfterMs =
    typeof body?.retryAfterMs === 'number' ? body.retryAfterMs : undefined;
  const retryable =
    typeof body?.retryable === 'boolean'
      ? body.retryable
      : res.status >= 500 || res.status === 429 || code === 'RATE_LIMIT';
  return new ApiError(String(msg), res.status, { code, retryable, retryAfterMs });
}

/** Success-body parse. A 200 with garbage is a server bug, not data. */
async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('Unparseable server response.', res.status, {
      code: 'PARSE',
      retryable: true,
    });
  }
}

/**
 * Silent single credential rotation for a dying session. Guest-only by
 * construction (accounts carry no refresh token here — only a re-login
 * fixes those). Shared in-flight with HTTP 401 recovery, so a socket auth
 * failure racing an API 401 rotates exactly once. Returns true when play
 * can continue on the new credential.
 */
export function refreshSessionOnce(): Promise<boolean> {
  return refreshOnce();
}

/**
 * In-flight guest refresh, shared so parallel 401s trigger exactly one
 * rotation. Without this, five simultaneous requests would each present the
 * same refresh token — and since rotation invalidates the previous one, four
 * of them would look like a replay and get the session revoked.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      // Read the refresh token from the canonical identity in memory. The old
      // synchronous storage shim returned null on Android, so this path — and
      // therefore the 401 recovery below — never ran on a phone.
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const next = await refreshGuestSession(refreshToken);
        patchIdentity({ accessToken: next.accessToken, refreshToken: next.refreshToken });
        // The live socket still holds the previous access token; it observes
        // identity changes and rebuilds itself.
        socketManager.syncWithIdentity();
        return true;
      } catch (error) {
        // Only a definitively rejected session is discarded. A network blip
        // must not throw away a working identity and send the player to
        // onboarding.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          clearIdentity();
        }
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true,
  timeoutMs = 12000
): Promise<T> {
  const attempt = async (signal: AbortSignal): Promise<Response> => {
    const authHeaders = await getAuthHeader();
    return fetch(`${API_URL}${path}`, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });
  };

  const run = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await attempt(ctrl.signal);
    } catch (e) {
      throw toNetworkError(e);
    } finally {
      clearTimeout(timer);
    }
  };

  // Transport never completed: refresh cannot help (nothing was answered).
  // A NetworkError keeps the identity; only a rejected session clears it.
  let res = await run();

  // An expired guest access token is recoverable: rotate once and replay.
  // Accounts never reach here — their 401 means the Supabase session is gone,
  // which only a re-login can fix.
  if (res.status === 401 && allowRefresh && getRefreshToken()) {
    if (await refreshOnce()) {
      res = await run();
    }
  }

  if (!res.ok) {
    throw await throwHttpError(res, `Request failed with status ${res.status}`);
  }

  return parseJson<T>(res);
}

export const api = {
  async getMe(): Promise<UserMeDto> {
    return request<UserMeDto>('/me');
  },

  /** Raw `Profile` row returned by PATCH /me/profile (not a UserMeDto). */
  async updateProfile(data: { username?: string; displayName?: string }): Promise<ProfileRowDto> {
    return request<ProfileRowDto>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Saves the shareable @handle. Throws ApiError(409) when it is taken and
   * ApiError(400) when it violates the character/length policy.
   */
  async updateUsername(username: string): Promise<ProfileRowDto> {
    return request<ProfileRowDto>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ username }),
    });
  },

  /** Saves the label opponents see in rooms, seats and the HUD. */
  async updateDisplayName(displayName: string): Promise<ProfileRowDto> {
    return request<ProfileRowDto>('/me/profile', {
      method: 'PATCH',
      body: JSON.stringify({ displayName }),
    });
  },

  /** Live availability probe for the username editor. */
  async checkUsernameAvailability(username: string): Promise<UsernameAvailabilityDto> {
    return request<UsernameAvailabilityDto>(
      `/users/username-available?username=${encodeURIComponent(username.trim())}`
    );
  },

  async getPublicProfile(userId: string): Promise<PublicProfileDto> {
    return request<PublicProfileDto>(`/profiles/${userId}`);
  },

  async searchUsers(query: string): Promise<PublicProfileDto[]> {
    if (!query.trim()) return [];
    return request<PublicProfileDto[]>(
      `/users/search?q=${encodeURIComponent(query.trim())}`,
      {},
      true,
      8000
    );
  },

  async getFriends(): Promise<FriendItemDto[]> {
    return request<FriendItemDto[]>('/friends');
  },

  /** Live lobby headcount (everyone online, not just friends). Null only when
   * the server answered without a count — transport failures throw, so the
   * UI can tell "checking" apart from "nobody online". */
  async getOnlineCount(): Promise<number | null> {
    const res = await request<{ count: number }>('/presence/online');
    return typeof res?.count === 'number' ? res.count : null;
  },

  async getFriendRequests(): Promise<FriendRequestItemDto[]> {
    const res = await request<FriendRequestItemDto[] | { incoming: FriendRequestItemDto[] }>(
      '/friends/requests'
    );
    return Array.isArray(res) ? res : res.incoming ?? [];
  },

  async getOutgoingRequestUserIds(): Promise<string[]> {
    const res = await request<
      { outgoing: { id: string; toUserId: string }[] } | { toUserId: string }[]
    >('/friends/requests');
    if (Array.isArray(res)) return res.map((r) => r.toUserId);
    return (res.outgoing ?? []).map((r) => r.toUserId);
  },

  async sendFriendRequest(params: { toUsername?: string; toUserId?: string }): Promise<{ success: boolean; message?: string }> {
    return request<{ success: boolean; message?: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async respondFriendRequest(requestId: string, accept: boolean): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/friends/request/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accept }),
    });
  },

  async removeFriend(friendId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/friends/${friendId}`, {
      method: 'DELETE',
    });
  },

  /**
   * UGC moderation (Play UGC policy): block / unblock / list / report.
   * Blocked players cannot friend, challenge or matchmake with you;
   * reports land in the server moderation queue (10/day anti-spam cap).
   */
  async blockUser(userId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/friends/block/${userId}`, {
      method: 'POST',
    });
  },

  async unblockUser(userId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/friends/block/${userId}`, {
      method: 'DELETE',
    });
  },

  async getBlocked(): Promise<{ id: string; username: string; displayName: string }[]> {
    return request<{ id: string; username: string; displayName: string }[]>('/friends/blocks');
  },

  async isBlocked(userId: string): Promise<boolean> {
    const res = await request<{ blocked: boolean }>(`/friends/block/${userId}`);
    return res?.blocked === true;
  },

  async submitReport(body: {
    targetUserId: string;
    reason: string;
    details?: string;
    gameId?: string;
  }): Promise<{ submitted: boolean; id?: string }> {
    return request<{ submitted: boolean; id?: string }>('/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getLeaderboard(mode = 'CLASSIC_1V1', limit = 50, offset = 0): Promise<LeaderboardPageDto> {
    const res = await request<LeaderboardPageDto | LeaderboardEntryDto[]>(
      `/leaderboard?mode=${mode}&limit=${limit}&offset=${offset}`
    );
    // An old server still returns a bare array: wrap it so paging math works.
    if (Array.isArray(res)) {
      return { entries: res, total: res.length, limit: res.length, offset: 0 };
    }
    return res;
  },

  /** The caller's own board position with a window around it. */
  async getMyRank(): Promise<MyRankDto> {
    return request<MyRankDto>('/leaderboard/me');
  },

  async getRatingHistory(userId: string, mode = 'CLASSIC_1V1', limit = 20): Promise<RatingHistoryPointDto[]> {
    return request<RatingHistoryPointDto[]>(`/users/${userId}/rating-history?mode=${mode}&limit=${limit}`);
  },

  async getMyHistory(limit = 20, offset = 0): Promise<HistoryResponseDto> {
    return request<HistoryResponseDto>(`/games/history?limit=${limit}&offset=${offset}`);
  },

  async getUserHistory(userId: string, limit = 20, offset = 0): Promise<HistoryResponseDto> {
    return request<HistoryResponseDto>(`/games/user/${userId}/history?limit=${limit}&offset=${offset}`);
  },

  async getGameReplay(gameId: string): Promise<any> {
    return request<any>(`/games/${gameId}`);
  },

  /**
   * Records a verified hard-AI win. Throws ApiError on HTTP failure —
   * callers decide between "server said no" (4xx: never retry, never show)
   * and "unreachable" (network throw: queue for later, stay silent).
   */
  async submitAiWin(body: SubmitAiWinBody): Promise<AiWinReward> {
    return request<AiWinReward>('/ai-wins', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Own hard-AI wins newest-first, without notation. */
  async getMyAiWins(limit = 20, offset = 0): Promise<{ wins: AiWinListItemDto[]; total: number }> {
    return request<{ wins: AiWinListItemDto[]; total: number }>(
      `/ai-wins/mine?limit=${limit}&offset=${offset}`
    );
  },

  /** Full win record including notation, for replay and analysis. */
  async getAiWinDetail(id: string): Promise<AiWinDetailDto> {
    return request<AiWinDetailDto>(`/ai-wins/${id}`);
  },

  /** Earned badges, equipped slots, and the catalog with earned flags. */
  async getMyAchievements(): Promise<AchievementsResponseDto> {
    return request<AchievementsResponseDto>('/achievements/me');
  },

  /** Sets the three profile showcase slots. Returns the refreshed view. */
  async setEquippedBadges(slots: (string | null)[]): Promise<AchievementsResponseDto> {
    return request<AchievementsResponseDto>('/me/badges', {
      method: 'PATCH',
      body: JSON.stringify({ slots }),
    });
  },

  async linkGuest(guestId: string, accessToken?: string): Promise<{ success: boolean }> {
    void accessToken;
    return request<{ success: boolean }>('/link', {
      method: 'POST',
      body: JSON.stringify({ guestId }),
    });
  },

  /**
   * Permanently deletes the signed-in account and all linked data.
   * Play Account Deletion requirement - surfaces in Settings > Danger Zone
   * and is documented at GET /legal/delete-account. Throws ApiError on
   * failure; callers must sign out + wipe local state only on success.
   */
  async deleteAccount(): Promise<{ deleted: boolean; userId?: string }> {
    return request<{ deleted: boolean; userId?: string }>('/me', {
      method: 'DELETE',
    });
  },

  /**
   * Derives real Head-to-Head competitive statistics between the logged in user
   * and a target player from the user's authentic match history.
   */
  computeHeadToHead(
    allGames: GameHistoryItemDto[],
    targetUserId: string,
    targetUsername?: string
  ): HeadToHeadStats {
    const headToHeadMatches = allGames.filter((g) => {
      if (!g.opponent) return false;
      if (g.opponent.userId === targetUserId) return true;
      if (targetUsername && g.opponent.username.toLowerCase() === targetUsername.toLowerCase()) return true;
      return false;
    });

    // Chronologically sort (oldest to newest) to calculate streaks
    const chronological = [...headToHeadMatches].sort((a, b) => {
      const timeA = new Date(a.endedAt).getTime();
      const timeB = new Date(b.endedAt).getTime();
      return timeA - timeB;
    });

    let myWins = 0;
    let theirWins = 0;
    let draws = 0;

    for (const match of headToHeadMatches) {
      if (match.outcome === 'WIN') myWins++;
      else if (match.outcome === 'LOSS') theirWins++;
      else draws++;
    }

    const totalGames = headToHeadMatches.length;
    const myWinRate = totalGames > 0 ? Math.round((myWins / totalGames) * 100) : 0;
    const theirWinRate = totalGames > 0 ? Math.round((theirWins / totalGames) * 100) : 0;

    const lastMatch = headToHeadMatches[0] ?? null;
    const lastResult = lastMatch ? lastMatch.outcome : null;

    // Calculate current streak
    let currentStreak: { holder: 'YOU' | 'OPPONENT'; count: number } | null = null;
    if (chronological.length > 0) {
      const lastOutcome = chronological[chronological.length - 1].outcome;
      if (lastOutcome === 'WIN' || lastOutcome === 'LOSS') {
        const holder = lastOutcome === 'WIN' ? 'YOU' : 'OPPONENT';
        let count = 0;
        for (let i = chronological.length - 1; i >= 0; i--) {
          if (chronological[i].outcome === lastOutcome) {
            count++;
          } else {
            break;
          }
        }
        if (count >= 1) {
          currentStreak = { holder, count };
        }
      }
    }

    return {
      totalGames,
      myWins,
      theirWins,
      draws,
      myWinRate,
      theirWinRate,
      lastResult,
      currentStreak,
      recentMatches: headToHeadMatches,
    };
  },

  /**
   * Request high-performance match analysis from the server's native Rust engine.
   */
  async requestGameReview(
    initialState: GameState,
    history: RecordedAction[]
  ): Promise<GameReview> {
    return request<GameReview>('/analysis/review', {
      method: 'POST',
      body: JSON.stringify({ initialState, history }),
    });
  },

  /**
   * Fetch cached match analysis from the server by gameId.
   */
  async getGameReview(gameId: string): Promise<GameReview> {
    return request<GameReview>(`/analysis/${gameId}`, {
      method: 'GET',
    });
  },
};

