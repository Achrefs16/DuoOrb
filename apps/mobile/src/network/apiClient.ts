import { API_URL } from './config';
import {
  clearIdentity,
  getAccessTokenSync,
  getRefreshToken,
  patchIdentity,
} from './auth';
import { socketManager } from './socket';

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

/** One badge with catalog text, as the server returns it. */
export interface BadgeDto {
  code: string;
  name: string;
  description: string;
  /** How to earn it, shown in the badge detail view. */
  requirement: string;
  /** Feather icon name. */
  icon: string;
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
  catalog: (BadgeDto & { earned: boolean })[];
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
  const res = await fetch(`${API_URL}/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const raw = body?.message;
    const msg = Array.isArray(raw) ? raw[0] : raw || `Could not start a guest session (${res.status})`;
    throw new ApiError(String(msg), res.status);
  }
  return res.json() as Promise<GuestCredentialsDto>;
}

/**
 * Trades the refresh token for a new pair. Both tokens rotate server-side, so
 * the old ones stop working immediately.
 */
export async function refreshGuestSession(
  refreshToken: string
): Promise<GuestCredentialsDto> {
  const res = await fetch(`${API_URL}/guest/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const raw = body?.message;
    const msg = Array.isArray(raw) ? raw[0] : raw || `Could not refresh the session (${res.status})`;
    throw new ApiError(String(msg), res.status);
  }
  return res.json() as Promise<GuestCredentialsDto>;
}

/**
 * Error carrying the HTTP status, so callers can branch on 409 (username
 * taken) vs 400 (policy violation) instead of string-matching the message.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
  allowRefresh = true
): Promise<T> {
  const attempt = async (): Promise<Response> => {
    const authHeaders = await getAuthHeader();
    return fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
    });
  };

  let res = await attempt();

  // An expired guest access token is recoverable: rotate once and replay.
  // Accounts never reach here — their 401 means the Supabase session is gone,
  // which only a re-login can fix.
  if (res.status === 401 && allowRefresh && getRefreshToken()) {
    if (await refreshOnce()) {
      res = await attempt();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    // Nest sends `message` as a string or an array of validation errors.
    const raw = body?.message;
    const msg = Array.isArray(raw) ? raw[0] : raw || `Request failed with status ${res.status}`;
    throw new ApiError(String(msg), res.status);
  }

  return res.json() as Promise<T>;
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
    return request<PublicProfileDto[]>(`/users/search?q=${encodeURIComponent(query.trim())}`);
  },

  async getFriends(): Promise<FriendItemDto[]> {
    return request<FriendItemDto[]>('/friends');
  },

  /** Live lobby headcount (everyone online, not just friends). */
  async getOnlineCount(): Promise<number> {
    const res = await request<{ count: number }>('/presence/online').catch(() => null);
    return typeof res?.count === 'number' ? res.count : 0;
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
    const res = await request<{ blocked: boolean }>(`/friends/block/${userId}`).catch(() => null);
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

  async getLeaderboard(mode = 'CLASSIC_1V1', limit = 50): Promise<LeaderboardEntryDto[]> {
    return request<LeaderboardEntryDto[]>(`/leaderboard?mode=${mode}&limit=${limit}`);
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
};
