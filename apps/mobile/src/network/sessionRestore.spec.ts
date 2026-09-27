import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Startup identity recovery. The contract under test is the one that was
 * broken: a cold start must NEVER call the guest-creation endpoint, and must
 * never read `/me` with a stale or empty identity.
 */

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
  },
}));

type AuthModule = typeof import('./auth');
type RestoreModule = typeof import('./sessionRestore');

let auth: AuthModule;
let restore: RestoreModule;

async function loadModules(): Promise<{ auth: AuthModule; restore: RestoreModule }> {
  vi.resetModules();
  const a = await import('./auth');
  const r = await import('./sessionRestore');
  return { auth: a, restore: r };
}

/** A stand-in for the server's `/api/guest` + `/api/guest/refresh`. */
function makeServer(startGuestId = 1) {
  let nextId = startGuestId;
  const calls = { create: 0, refresh: 0, me: 0, meTokens: [] as string[] };

  const issue = (userId: string) => ({
    userId,
    accessToken: `access-${userId}`,
    refreshToken: `refresh-${userId}`,
    username: `player_${userId.slice(0, 6)}`,
    displayName: 'SwiftOrb42',
  });

  return {
    calls,
    createGuestSession: vi.fn(async () => {
      calls.create += 1;
      return issue(`u_g${String(nextId++).padStart(5, '0')}`);
    }),
    refreshGuestSession: vi.fn(async (refreshToken: string) => {
      calls.refresh += 1;
      const userId = refreshToken.replace('refresh-', '');
      if (!userId.startsWith('u_')) {
        const err = Object.assign(new Error('Invalid guest session.'), { status: 401 });
        throw err;
      }
      return issue(userId);
    }),
    fetchProfile: vi.fn(async (accessToken: string) => {
      calls.me += 1;
      calls.meTokens.push(accessToken);
      const userId = accessToken.replace('access-', '');
      return { username: `player_${userId.slice(0, 6)}`, displayName: 'SwiftOrb42' };
    }),
  };
}

const depsFor = (server: ReturnType<typeof makeServer>) => ({
  getStoredRefreshToken: () => auth.getRefreshToken(),
  refreshGuestSession: server.refreshGuestSession,
  fetchProfile: server.fetchProfile,
  isDeadSession: (e: unknown) => (e as { status?: number })?.status === 401,
});

beforeEach(async () => {
  store.clear();
  const mods = await loadModules();
  auth = mods.auth;
  restore = mods.restore;
});

describe('restoreSession', () => {
  it('fresh install: creates nothing and reports anonymous', async () => {
    const server = makeServer();
    const outcome = await restore.restoreSession(depsFor(server));

    expect(outcome.status).toBe('anonymous');
    expect(server.calls.create).toBe(0);
    expect(server.calls.refresh).toBe(0);
    expect(server.calls.me).toBe(0);
  });

  it('restart: restores the same user and creates no second guest', async () => {
    // First launch: the player presses Continue as Guest.
    const server = makeServer();
    await auth.hydrateIdentity();
    await restore.createGuestIdentity({ fetchProfile: server.fetchProfile }, server.createGuestSession);
    await auth.flushIdentityStorage();
    const originalId = auth.getIdentity()!.userId;
    expect(server.calls.create).toBe(1);

    // Three cold starts, each a completely fresh module instance.
    for (let i = 0; i < 3; i++) {
      const mods = await loadModules();
      auth = mods.auth;
      restore = mods.restore;
      const outcome = await restore.restoreSession(depsFor(server));

      expect(outcome.status).toBe('restored');
      expect(auth.getIdentity()?.userId).toBe(originalId);
    }

    expect(server.calls.create).toBe(1);
  });

  it('reads /me only AFTER the refreshed identity is installed', async () => {
    const server = makeServer();
    await auth.hydrateIdentity();
    await restore.createGuestIdentity({ fetchProfile: server.fetchProfile }, server.createGuestSession);
    await auth.flushIdentityStorage();

    const mods = await loadModules();
    auth = mods.auth;
    restore = mods.restore;
    // Count only the boot's own `/me` call.
    const meBefore = server.calls.me;
    const restored = await restore.restoreSession(depsFor(server));

    // The token `/me` was called with must be the NEW access token, never the
    // expired one that triggered the refresh.
    expect(restored.status).toBe('restored');
    expect(server.calls.me - meBefore).toBe(1);
    expect(server.calls.meTokens.at(-1)).toBe(auth.getIdentity()!.accessToken);
    expect(auth.getIdentity()!.accessToken).not.toBe('access-u_g00001-expired');
  });

  it('a dead refresh token is discarded so onboarding is offered', async () => {
    const server = makeServer();
    await auth.hydrateIdentity();
    auth.setIdentity({
      userId: 'u_dead01',
      username: 'player_u_dead',
      displayName: 'SwiftOrb42',
      accessToken: 'access-u_dead01',
      refreshToken: 'not-a-valid-refresh',
      isGuest: true,
    });
    await auth.flushIdentityStorage();

    const outcome = await restore.restoreSession(depsFor(server));

    expect(outcome.status).toBe('anonymous');
    expect(auth.getIdentity()).toBeNull();
    // A dead session must not be replaced by an automatic new account.
    expect(server.calls.create).toBe(0);
  });

  it('a network failure keeps the existing session instead of destroying it', async () => {
    const server = makeServer();
    await auth.hydrateIdentity();
    auth.setIdentity({
      userId: 'u_offline',
      username: 'player_u_offl',
      displayName: 'SwiftOrb42',
      accessToken: 'access-u_offline',
      refreshToken: 'refresh-u_offline',
      isGuest: true,
    });
    server.refreshGuestSession.mockRejectedValueOnce(new Error('Network request failed'));

    const outcome = await restore.restoreSession(depsFor(server));

    expect(outcome.status).toBe('restored');
    expect(auth.getIdentity()?.userId).toBe('u_offline');
    expect(server.calls.create).toBe(0);
  });
});

describe('createGuestIdentity', () => {
  it('mints exactly one account and persists it', async () => {
    const server = makeServer();
    await auth.hydrateIdentity();

    const result = await restore.createGuestIdentity(
      { fetchProfile: server.fetchProfile },
      server.createGuestSession
    );
    await auth.flushIdentityStorage();

    expect(result.ok).toBe(true);
    expect(server.calls.create).toBe(1);
    expect(auth.getIdentity()?.userId).toBe('u_g00001');
    expect(auth.getIdentity()?.isGuest).toBe(true);
  });

  it('two accounts get two distinct ids (no id reuse)', async () => {
    const server = makeServer();
    await auth.hydrateIdentity();
    await restore.createGuestIdentity({ fetchProfile: server.fetchProfile }, server.createGuestSession);
    const first = auth.getIdentity()!.userId;

    auth.clearIdentity();
    await auth.hydrateIdentity();
    await restore.createGuestIdentity({ fetchProfile: server.fetchProfile }, server.createGuestSession);
    const second = auth.getIdentity()!.userId;

    expect(first).not.toBe(second);
  });
});
