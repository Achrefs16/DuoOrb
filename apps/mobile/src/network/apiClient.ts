import { API_URL } from './config';
import {
  clearGuestCredentials,
  getCurrentUser,
  getStoredRefreshToken,
  updateGuestTokens,
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
}

export interface PublicProfileDto {
  id: string;
  username: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt?: string | number;
  ratings?: Record<string, UserRatingDto>;
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

let activeTokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenProvider(getter: () => Promise<string | null>) {
  activeTokenGetter = getter;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  if (activeTokenGetter) {
    const token = await activeTokenGetter();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  const fallback = getCurrentUser();
  if (fallback?.token) {
    return { Authorization: `Bearer ${fallback.token}` };
  }
  return {};
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
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return false;
      try {
        const next = await refreshGuestSession(refreshToken);
        updateGuestTokens(next.accessToken, next.refreshToken);
        // A live socket still holds the previous access token. Without this it
        // would keep presenting an expired credential until it reconnects.
        socketManager.updateAuthToken(next.accessToken);
        return true;
      } catch {
        // Expired or revoked: forget it so the next boot starts clean.
        clearGuestCredentials();
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
  if (res.status === 401 && allowRefresh && getStoredRefreshToken()) {
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

  async linkGuest(guestId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/link', {
      method: 'POST',
      body: JSON.stringify({ guestId }),
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
