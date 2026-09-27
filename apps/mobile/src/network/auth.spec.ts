import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The identity store, exercised the way Android actually runs it: no
 * `window`, so every read must go through AsyncStorage. These are the tests
 * that would have caught the original defect — the store used to route reads
 * through a `localStorage` shim whose native branch always returned null, so
 * the app believed it had no session and minted a new guest on every launch.
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
let auth: AuthModule;

async function freshModule(): Promise<AuthModule> {
  vi.resetModules();
  return import('./auth');
}

const guest = (id: string) => ({
  userId: id,
  username: `player_${id.slice(0, 6)}`,
  displayName: 'SwiftOrb42',
  accessToken: `access-${id}`,
  refreshToken: `refresh-${id}`,
  isGuest: true,
});

beforeEach(async () => {
  store.clear();
  auth = await freshModule();
});

describe('canonical identity store (native / Android)', () => {
  it('starts with no identity on a fresh install', async () => {
    await auth.hydrateIdentity();
    expect(auth.getIdentity()).toBeNull();
  });

  it('persists a guest and restores the SAME user after a restart', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_aaa111'));

    // Simulate a process kill: queued writes settle, then every scrap of
    // in-memory state is discarded.
    await auth.flushIdentityStorage();

    const afterRestart = await freshModule();
    await afterRestart.hydrateIdentity();

    expect(afterRestart.getIdentity()?.userId).toBe('u_aaa111');
  });

  it('survives three consecutive restarts without changing the user', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_bbb222'));
    await auth.flushIdentityStorage();

    for (let i = 0; i < 3; i++) {
      const mod = await freshModule();
      await mod.hydrateIdentity();
      expect(mod.getIdentity()?.userId).toBe('u_bbb222');
      await mod.flushIdentityStorage();
    }
  });

  it('exposes the refresh token on native (the old sync shim returned null)', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_ccc333'));
    expect(auth.getRefreshToken()).toBe('refresh-u_ccc333');
  });

  it('exposes the refresh token after a restart, not only right after minting', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_ddd444'));
    await auth.flushIdentityStorage();

    const afterRestart = await freshModule();
    await afterRestart.hydrateIdentity();
    expect(afterRestart.getRefreshToken()).toBe('refresh-u_ddd444');
  });

  it('stores one document, so there is no key ordering to get wrong', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_eee555'));
    await auth.flushIdentityStorage();
    expect([...store.keys()]).toEqual(['@duoorb:identity:v2']);
  });

  it('ignores a corrupt persisted document instead of crashing the boot', async () => {
    store.set('@duoorb:identity:v2', '{not json');
    const mod = await freshModule();
    await mod.hydrateIdentity();
    expect(mod.getIdentity()).toBeNull();
  });

  it('ignores a document from an older schema', async () => {
    store.set(
      '@duoorb:identity:v2',
      JSON.stringify({ v: 1, userId: 'u_old', accessToken: 'x' })
    );
    const mod = await freshModule();
    await mod.hydrateIdentity();
    expect(mod.getIdentity()).toBeNull();
  });

  it('replaces the identity atomically rather than merging two accounts', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_first'));
    auth.setIdentity(guest('u_second'));
    await auth.flushIdentityStorage();

    const afterRestart = await freshModule();
    await afterRestart.hydrateIdentity();
    expect(afterRestart.getIdentity()?.userId).toBe('u_second');
  });

  it('notifies subscribers on every identity change', async () => {
    await auth.hydrateIdentity();
    const seen: (string | null)[] = [];
    const unsubscribe = auth.subscribeIdentity(() => seen.push(auth.getIdentity()?.userId ?? null));

    auth.setIdentity(guest('u_fff666'));
    auth.applyServerProfile({ username: 'achra', displayName: 'Achraf' });
    unsubscribe();
    auth.setIdentity(guest('u_999999'));

    // Two notifications: the credential write and the server-name write. The
    // change after `unsubscribe` must not be delivered.
    expect(seen).toEqual(['u_fff666', 'u_fff666']);
  });

  it('records only server-confirmed names and never invents one', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity({ ...guest('u_ggg777'), username: '', displayName: '' });
    auth.applyServerProfile({ username: '  achra  ', displayName: '  Achraf  ' });

    const identity = auth.getIdentity();
    expect(identity?.username).toBe('achra');
    expect(identity?.displayName).toBe('Achraf');
  });

  it('clearing the session removes it from disk too', async () => {
    await auth.hydrateIdentity();
    auth.setIdentity(guest('u_hhh888'));
    await auth.flushIdentityStorage();

    auth.clearIdentity();
    await auth.flushIdentityStorage();
    expect(store.size).toBe(0);

    const afterRestart = await freshModule();
    await afterRestart.hydrateIdentity();
    expect(afterRestart.getIdentity()).toBeNull();
  });

  it('refuses an identity with no server-issued id', async () => {
    await auth.hydrateIdentity();
    expect(() => auth.setIdentity({ ...guest(''), userId: '' })).toThrow();
  });
});
