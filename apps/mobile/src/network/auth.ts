import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserIdentity {
  userId: string;
  displayName: string;
  email: string;
  /** Bearer token: a server-signed guest token, or a Supabase account JWT. */
  token: string;
  /** Public @handle, once the server profile has been loaded. */
  username?: string;
  /**
   * Long-lived opaque token used to mint a new access token. Guest sessions
   * only; accounts refresh through Supabase.
   */
  refreshToken?: string;
}

const STORAGE_KEY_USER_ID = '@duoorb:auth:user_id';
const STORAGE_KEY_DISPLAY_NAME = '@duoorb:auth:display_name';
const STORAGE_KEY_TOKEN = '@duoorb:auth:token';
const STORAGE_KEY_USERNAME = '@duoorb:auth:username';
const STORAGE_KEY_REFRESH = '@duoorb:auth:refresh_token';

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

const storage = {
  getItem: (key: string): string | null => {
    try {
      if (hasLocalStorage()) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // ignore
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (hasLocalStorage()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // ignore
    }
    // Native (no window.localStorage): persist async, best-effort.
    void AsyncStorage.setItem(key, value).catch(() => {});
  },
  removeItem: (key: string): void => {
    try {
      if (hasLocalStorage()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // ignore
    }
    void AsyncStorage.removeItem(key).catch(() => {});
  },
};

let cachedUser: UserIdentity | null = null;

function generateRandomId(): string {
  return 'u_' + Math.random().toString(36).substring(2, 10);
}

function generateRandomName(): string {
  const adjectives = ['Swift', 'Bold', 'Silent', 'Cosmic', 'Solar', 'Lunar', 'Echo', 'Neon', 'Apex', 'Shadow'];
  const nouns = ['Orb', 'Striker', 'Player', 'Tactician', 'Runner', 'Walker', 'Master', 'Spark', 'Pulse', 'Vanguard'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
}

/**
 * Native hydration: AsyncStorage survives app restarts where
 * window.localStorage does not exist. Call once at startup and wait for it
 * before rendering so the very first socket uses the stable identity —
 * otherwise every relaunch orphans rooms, seats and host crowns.
 */
export async function hydrateIdentity(): Promise<void> {
  if (cachedUser || hasLocalStorage()) return;
  try {
    const [userId, displayName, customToken, username, refreshToken] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_USER_ID),
      AsyncStorage.getItem(STORAGE_KEY_DISPLAY_NAME),
      AsyncStorage.getItem(STORAGE_KEY_TOKEN),
      AsyncStorage.getItem(STORAGE_KEY_USERNAME),
      AsyncStorage.getItem(STORAGE_KEY_REFRESH),
    ]);
    if (userId) {
      const email = `${userId}@duoorb.local`;
      cachedUser = {
        userId,
        displayName: displayName ?? generateRandomName(),
        email,
        token: customToken ?? '',
        ...(username ? { username } : {}),
        ...(refreshToken ? { refreshToken } : {}),
      };
      if (!displayName) {
        void AsyncStorage.setItem(STORAGE_KEY_DISPLAY_NAME, cachedUser.displayName).catch(
          () => {}
        );
      }
    }
  } catch {
    // fall through to fresh guest below
  }
}

/**
 * Retrieves the current user's identity.
 *
 * The local id/display name are a fast, offline placeholder only. Authority
 * comes from the token: a guest must hold a server-issued one (see
 * `createGuestSession`), and a signed-in player holds a Supabase JWT. There is
 * deliberately no locally-minted fallback any more — the server would reject
 * it, and a self-asserted identity is exactly the hole this replaced.
 */
export function getCurrentUser(): UserIdentity {
  if (cachedUser) return cachedUser;

  let userId = storage.getItem(STORAGE_KEY_USER_ID);
  let displayName = storage.getItem(STORAGE_KEY_DISPLAY_NAME);
  const customToken = storage.getItem(STORAGE_KEY_TOKEN);
  const refreshToken = storage.getItem(STORAGE_KEY_REFRESH) ?? undefined;

  if (!userId) {
    userId = generateRandomId();
    storage.setItem(STORAGE_KEY_USER_ID, userId);
  }

  if (!displayName) {
    displayName = generateRandomName();
    storage.setItem(STORAGE_KEY_DISPLAY_NAME, displayName);
  }

  const email = `${userId}@duoorb.local`;
  const username = storage.getItem(STORAGE_KEY_USERNAME) ?? undefined;

  cachedUser = {
    userId,
    displayName,
    email,
    token: customToken ?? '',
    ...(username ? { username } : {}),
    ...(refreshToken ? { refreshToken } : {}),
  };

  return cachedUser;
}

/**
 * Stores the credentials the server issued for a guest, and adopts the
 * identity that came with them. The server is the source of truth for the id,
 * the generated handle and the display name.
 */
export function setGuestCredentials(credentials: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  displayName: string;
}): UserIdentity {
  storage.setItem(STORAGE_KEY_USER_ID, credentials.userId);
  storage.setItem(STORAGE_KEY_TOKEN, credentials.accessToken);
  storage.setItem(STORAGE_KEY_REFRESH, credentials.refreshToken);
  storage.setItem(STORAGE_KEY_DISPLAY_NAME, credentials.displayName.slice(0, 24));
  // The previous handle belonged to the old identity and must not carry over.
  storage.removeItem(STORAGE_KEY_USERNAME);

  cachedUser = {
    userId: credentials.userId,
    displayName: credentials.displayName.slice(0, 24),
    email: `${credentials.userId}@duoorb.local`,
    token: credentials.accessToken,
    refreshToken: credentials.refreshToken,
  };
  return cachedUser;
}

/**
 * Swaps in a freshly rotated access token. The refresh token rotates too, so
 * the previous one is worthless from this moment on.
 */
export function updateGuestTokens(accessToken: string, refreshToken: string): void {
  storage.setItem(STORAGE_KEY_TOKEN, accessToken);
  storage.setItem(STORAGE_KEY_REFRESH, refreshToken);
  if (cachedUser) {
    cachedUser = { ...cachedUser, token: accessToken, refreshToken };
  }
}

/** The stored guest refresh token, if any. */
export function getStoredRefreshToken(): string | null {
  return storage.getItem(STORAGE_KEY_REFRESH);
}

/** Forgets guest credentials so the next boot requests a fresh identity. */
export function clearGuestCredentials(): void {
  storage.removeItem(STORAGE_KEY_REFRESH);
  if (cachedUser && !cachedUser.refreshToken) return;
  cachedUser = null;
}

/**
 * Caches the server profile so the socket handshake, room slots and player
 * seats immediately use the name the player just chose. The session layer
 * fetches `/me` and calls this; `displayName` overrides whatever the identity
 * provider supplied, which is what opponents actually see in a match.
 */
export function cacheProfile(profile: { username?: string; displayName?: string }): UserIdentity {
  const current = getCurrentUser();

  if (profile.username) {
    storage.setItem(STORAGE_KEY_USERNAME, profile.username);
  }
  const displayName = profile.displayName?.trim().slice(0, 24);
  if (displayName) {
    storage.setItem(STORAGE_KEY_DISPLAY_NAME, displayName);
  }

  cachedUser = {
    ...current,
    ...(profile.username ? { username: profile.username } : {}),
    ...(displayName ? { displayName } : {}),
  };
  return cachedUser;
}

/**
 * Updates the user's local display name.
 */
export function updateDisplayName(newName: string): UserIdentity {
  const current = getCurrentUser();
  const trimmed = newName.trim().slice(0, 24);
  if (!trimmed) return current;

  storage.setItem(STORAGE_KEY_DISPLAY_NAME, trimmed);
  cachedUser = {
    ...current,
    displayName: trimmed,
  };
  return cachedUser;
}

/**
 * Adopts the signed-in account as the canonical identity (replacing the
 * guest id everywhere: rooms, seats, host, queue). Keeps the local
 * display name so a claimed username survives sign-in. Returns the
 * previous id so the socket layer can hand it to the server for
 * live-state migration.
 */
export function adoptAccountIdentity(accountId: string): string | null {
  const current = getCurrentUser();
  if (current.userId === accountId) return null;
  const prevId = current.userId;
  storage.setItem(STORAGE_KEY_USER_ID, accountId);
  cachedUser = {
    ...current,
    userId: accountId,
    email: `${accountId}@duoorb.local`,
  };
  return prevId;
}

/**
 * Drops back to a brand-new guest (sign-out). Previous account rooms
 * stay under the account id by design.
 *
 * Guest credentials are cleared too, so the next bootstrap asks the server
 * for a new identity instead of carrying the account's bearer token.
 */
export function resetToNewGuest(): UserIdentity {
  cachedUser = null;
  const userId = generateRandomId();
  const displayName = generateRandomName();
  storage.setItem(STORAGE_KEY_USER_ID, userId);
  storage.setItem(STORAGE_KEY_DISPLAY_NAME, displayName);
  // The signed-in account's handle must never leak onto the fresh guest.
  storage.removeItem(STORAGE_KEY_USERNAME);
  storage.removeItem(STORAGE_KEY_TOKEN);
  storage.removeItem(STORAGE_KEY_REFRESH);
  return getCurrentUser();
}

/**
 * Sets the bearer token used for every request (Supabase account JWT, or a
 * server-issued guest token).
 */
export function setAuthToken(token: string | null): void {
  if (token) {
    storage.setItem(STORAGE_KEY_TOKEN, token);
  } else {
    storage.removeItem(STORAGE_KEY_TOKEN);
  }
  // A Supabase session replaces any guest credentials, and the guest session
  // was revoked server-side when the accounts were merged, so the local
  // refresh token is dead weight from here on.
  storage.removeItem(STORAGE_KEY_REFRESH);
  cachedUser = null;
}
