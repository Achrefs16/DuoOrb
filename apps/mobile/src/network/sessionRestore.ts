import {
  CanonicalIdentity,
  applyServerProfile,
  clearIdentity,
  getIdentity,
  hydrateIdentity,
  setIdentity,
} from './auth';

/**
 * Startup identity recovery, isolated from React so the ordering can be
 * proven by tests instead of by inspection.
 *
 * The contract, in order and with nothing interleaved:
 *
 *   hydrate persisted session
 *     -> restore/refresh the session
 *       -> load /me
 *         -> install the canonical identity
 *
 * If there is no session to restore, this STOPS. It does not create a guest.
 * Account creation is a user action and lives in `createGuestIdentity` below,
 * which is only ever called from the Continue as Guest button.
 */

export type RestoreOutcome =
  /** A usable session was recovered; `profileLoaded` says whether /me answered. */
  | { status: 'restored'; identity: CanonicalIdentity; profileLoaded: boolean }
  /** No session, or the stored one is dead. Onboarding must be shown. */
  | { status: 'anonymous'; reason: 'no-session' | 'dead-session' | 'offline' };

export interface GuestCredentials {
  userId: string;
  accessToken: string;
  refreshToken: string;
  /** Server-generated handle; a real `/me` read may replace it. */
  username?: string;
  displayName?: string;
}

export interface ServerProfile {
  username: string;
  displayName: string;
}

export interface RestoreDeps {
  /** Reads the persisted refresh token. Must read memory, not a sync shim. */
  getStoredRefreshToken: () => string | null;
  /** Exchanges a refresh token for a fresh pair. */
  refreshGuestSession: (refreshToken: string) => Promise<GuestCredentials>;
  /** The authenticated `/me` read. */
  fetchProfile: (accessToken: string) => Promise<ServerProfile>;
  /**
   * True when the error means the stored session can never work again
   * (HTTP 401/403) and must be discarded. Anything else is transport noise
   * and must not destroy a session that is merely unreachable right now.
   */
  isDeadSession: (error: unknown) => boolean;
}

/**
 * Recovers an existing session. Creates nothing.
 *
 * A network failure while refreshing is deliberately NOT fatal: the persisted
 * identity (id + access token) is still on disk and may still be valid, so we
 * keep it, report `offline`, and let the caller render and retry. Only a
 * definitively rejected session is cleared.
 */
export async function restoreSession(deps: RestoreDeps): Promise<RestoreOutcome> {
  await hydrateIdentity();

  const existing = getIdentity();
  const stored = deps.getStoredRefreshToken();

  if (!stored) {
    // No refresh token. Either this device never had a session, or it is an
    // account whose token comes from Supabase. Either way: create nothing.
    if (existing && existing.accessToken) {
      const profile = await tryLoadProfile(deps, existing.accessToken);
      if (profile) {
        return { status: 'restored', identity: getIdentity() ?? existing, profileLoaded: true };
      }
      return { status: 'restored', identity: existing, profileLoaded: false };
    }
    return { status: 'anonymous', reason: 'no-session' };
  }

  try {
    const credentials = await deps.refreshGuestSession(stored);
    // Install credentials BEFORE reading /me, so the profile request can only
    // ever be authenticated as the identity that is about to be canonical.
    const installed = setIdentity({
      userId: credentials.userId,
      username: credentials.username ?? '',
      displayName: credentials.displayName ?? '',
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      isGuest: true,
    });
    const profile = await tryLoadProfile(deps, installed.accessToken);
    if (profile) {
      return { status: 'restored', identity: getIdentity() ?? installed, profileLoaded: true };
    }
    return { status: 'restored', identity: getIdentity() ?? installed, profileLoaded: false };
  } catch (error) {
    if (deps.isDeadSession(error)) {
      // The session is gone for good. Forget it so onboarding is offered
      // instead of the app retrying a credential that can never succeed.
      clearIdentity();
      return { status: 'anonymous', reason: 'dead-session' };
    }
    if (existing) {
      return { status: 'restored', identity: existing, profileLoaded: false };
    }
    return { status: 'anonymous', reason: 'offline' };
  }
}

/**
 * Reads `/me` and folds the server's names into the canonical identity.
 * Returns null on any failure — the caller decides whether that is fatal.
 */
export async function loadCanonicalProfile(
  accessToken: string,
  fetchProfile: (accessToken: string) => Promise<ServerProfile>
): Promise<CanonicalIdentity | null> {
  return tryLoadProfile({ fetchProfile }, accessToken);
}

async function tryLoadProfile(
  deps: Pick<RestoreDeps, 'fetchProfile'>,
  accessToken: string
): Promise<CanonicalIdentity | null> {
  try {
    const profile = await deps.fetchProfile(accessToken);
    if (!profile || !profile.username) return null;
    return applyServerProfile(profile) ?? getIdentity();
  } catch {
    return null;
  }
}

/**
 * Creates a guest. ONLY reachable from an explicit user action.
 *
 * Kept beside `restoreSession` on purpose: the asymmetry between the two
 * functions is the guarantee that a cold start can never mint an account.
 */
export async function createGuestIdentity(
  deps: Pick<RestoreDeps, 'fetchProfile'>,
  createGuestSession: () => Promise<GuestCredentials>
): Promise<{ ok: true; identity: CanonicalIdentity } | { ok: false; error: unknown }> {
  const credentials = await createGuestSession();
  const installed = setIdentity({
    userId: credentials.userId,
    username: credentials.username ?? '',
    displayName: credentials.displayName ?? '',
    accessToken: credentials.accessToken,
    refreshToken: credentials.refreshToken,
    isGuest: true,
  });
  // Load the profile immediately so the username step and every later screen
  // read server-confirmed values, never the mint-time placeholders.
  await tryLoadProfile(deps, installed.accessToken);
  return { ok: true, identity: getIdentity() ?? installed };
}
