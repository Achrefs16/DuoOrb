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
    // Native (no window.localStorage): persist async, ORDERED. The writes
    // used to race (placeholder id landing after the server id), so the
    // next boot could hydrate a phantom identity. Every native write goes
    // through one chain, in call order.
    enqueueWrite(() => AsyncStorage.setItem(key, value));
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
    enqueueWrite(() => AsyncStorage.removeItem(key));
  },
};

/** Serializes native storage writes so disk order always matches call order. */
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(op: () => Promise<unknown>): void {
  writeChain = writeChain.then(op, op).then(
    () => undefined,
    () => undefined
  );
}

/**
 * Resolves when every queued storage write has landed. Call on app
 * background (and before any destructive transition) so a kill can never
 * strand half an identity on disk.
 */
export function flushStorage(): Promise<void> {
  return writeChain;
}

type IdentityListener = () => void;
const identityListeners = new Set<IdentityListener>();

/**
 * Single-source-of-truth subscription: every mutation below notifies, so
 * the session layer (and any screen reading identity) converges on the
 * latest values instead of holding a stale first-paint snapshot.
 */
export function subscribeIdentity(fn: IdentityListener): () => void {
  identityListeners.add(fn);
  return () => {
    identityListeners.delete(fn);
  };
}

function emitIdentityChanged(): void {
  for (const fn of [...identityListeners]) {
    try {
      fn();
    } catch {
      // a listener must never break identity propagation
    }
  }
}

let cachedUser: UserIdentity | null = null;

/**
 * There is deliberately no client-side id generator any more.
 *
 * The device used to mint its own `local_<random>` identity and cache it,
 * because the sync storage shim reports "no stored id" on native. That made
 * the app believe in an identity the server had never issued, which cost the
 * player the room host crown (granted by id equality) and their game:join
 * (rejected as unseated), and made every name fall back to `player_<id>`. The
 * server allocates guest identities; the client only ever holds what it is
 * given.
 */

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

  // Native has no window.localStorage, so the sync shim always reports "no
  // stored id" here. The previous response was to invent a random one and
  // cache it, which produced a device that believed in an identity the server
  // had never issued: it could not become room host (the host crown is granted
  // by id equality), its game:join was rejected as unseated, and every name
  // fell back to `player_<id>`. It also explained why the fault moved between
  // phones — it depended purely on whether that launch's guest bootstrap
  // succeeded before this ran.
  //
  // An empty id is the honest answer: it means "no identity yet". The server
  // assigns one via createGuestSession -> setGuestCredentials, which replaces
  // this and re-renders consumers. Nothing may treat it as a real id.
  let userId = storage.getItem(STORAGE_KEY_USER_ID) ?? '';
  let displayName = storage.getItem(STORAGE_KEY_DISPLAY_NAME);
  const customToken = storage.getItem(STORAGE_KEY_TOKEN);
  const refreshToken = storage.getItem(STORAGE_KEY_REFRESH) ?? undefined;

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
  emitIdentityChanged();
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
    emitIdentityChanged();
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
  emitIdentityChanged();
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
  emitIdentityChanged();
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
  emitIdentityChanged();
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
  emitIdentityChanged();
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
  // No fabricated id: the server allocates the next guest identity. Writing a
  // random one here left the device asserting an identity that did not exist,
  // which is what cost the player the room host crown and the match join.
  const displayName = generateRandomName();
  storage.setItem(STORAGE_KEY_DISPLAY_NAME, displayName);
  // The signed-in account's handle must never leak onto the fresh guest.
  storage.removeItem(STORAGE_KEY_USERNAME);
  storage.removeItem(STORAGE_KEY_TOKEN);
  storage.removeItem(STORAGE_KEY_REFRESH);
  storage.removeItem(STORAGE_KEY_USER_ID);
  const fresh = getCurrentUser();
  emitIdentityChanged();
  return fresh;
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
  emitIdentityChanged();
}
