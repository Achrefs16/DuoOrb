import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The socket transport is derived from the canonical identity and nothing
 * else. Two guarantees are under test:
 *
 *  - a listener attached before the session exists still receives events
 *    after the transport is rebuilt (the challenge and room-invite hooks
 *    attach during the splash, long before any identity);
 *  - a rebuilt transport can never present a previous credential.
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

const created: any[] = [];

vi.mock('socket.io-client', () => ({
  io: (_url: string, opts: any) => {
    const listeners = new Map<string, Set<Function>>();
    const emitted: { event: string; args: unknown[] }[] = [];
    const socket: any = {
      opts,
      connected: false,
      emitted,
      on(event: string, fn: Function) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
        return socket;
      },
      off(event: string, fn?: Function) {
        if (!fn) listeners.delete(event);
        else listeners.get(event)?.delete(fn);
        return socket;
      },
      emit(event: string, ...args: unknown[]) {
        emitted.push({ event, args });
        return socket;
      },
      connect() {
        socket.connected = true;
        listeners.get('connect')?.forEach((fn) => fn());
        return socket;
      },
      disconnect() {
        socket.connected = false;
        listeners.get('disconnect')?.forEach((fn) => fn('io client disconnect'));
        return socket;
      },
      removeAllListeners() {
        listeners.clear();
        return socket;
      },
      io: {
        on() {},
      },
      // test helper: deliver a server event to whatever is attached now
      __fire(event: string, ...args: unknown[]) {
        listeners.get(event)?.forEach((fn) => fn(...args));
      },
    };
    created.push(socket);
    return socket;
  },
}));

type AuthModule = typeof import('./auth');
type SocketModule = typeof import('./socket');
let auth: AuthModule;
let socketMod: SocketModule;

async function load(): Promise<{ auth: AuthModule; socketMod: SocketModule }> {
  vi.resetModules();
  created.length = 0;
  const a = await import('./auth');
  const s = await import('./socket');
  return { auth: a, socketMod: s };
}

const identity = (userId: string, token: string, isGuest = true) => ({
  userId,
  username: `player_${userId.slice(0, 6)}`,
  displayName: 'SwiftOrb42',
  accessToken: token,
  refreshToken: `refresh-${userId}`,
  isGuest,
});

beforeEach(async () => {
  store.clear();
  const mods = await load();
  auth = mods.auth;
  socketMod = mods.socketMod;
  await auth.hydrateIdentity();
});

describe('socket transport follows the canonical identity', () => {
  it('does not connect before a session exists', () => {
    socketMod.socketManager.getSocket();
    expect(created).toHaveLength(0);
    expect(socketMod.socketManager.getStatus()).toBe('disconnected');
  });

  it('connects with the current token as soon as an identity exists', () => {
    socketMod.socketManager.getSocket();
    auth.setIdentity(identity('u_one', 'token-one'));

    expect(created).toHaveLength(1);
    expect(created[0].opts.auth).toEqual({ token: 'token-one' });
    expect(created[0].opts.query.userId).toBe('u_one');
    expect(created[0].connected).toBe(true);
    expect(socketMod.socketManager.getStatus()).toBe('connected');
  });

  it('keeps listeners attached across a transport rebuild', () => {
    const received: unknown[] = [];
    // Attached BEFORE any identity exists — this is what the challenge and
    // room-invite hooks do while the splash is still up.
    socketMod.socketManager.getSocket().on('challenge:received', (p: unknown) => received.push(p));

    auth.setIdentity(identity('u_one', 'token-one'));
    created[0].__fire('challenge:received', { id: 'c1' });

    // Now force a rebuild by changing the credential.
    auth.patchIdentity({ accessToken: 'token-two' });
    expect(created).toHaveLength(2);
    expect(created[1].opts.auth).toEqual({ token: 'token-two' });

    // The listener must still be attached to the NEW transport.
    created[1].__fire('challenge:received', { id: 'c2' });
    expect(received).toEqual([{ id: 'c1' }, { id: 'c2' }]);
  });

  it('never re-presents a previous identity after a rebuild', () => {
    socketMod.socketManager.getSocket();
    auth.setIdentity(identity('u_guest', 'token-guest'));
    expect(created[0].opts.query.userId).toBe('u_guest');

    // Sign in as an account: different id, different token.
    auth.setIdentity(identity('acct-uuid', 'token-account', false));

    expect(created).toHaveLength(2);
    expect(created[1].opts.query.userId).toBe('acct-uuid');
    expect(created[1].opts.auth).toEqual({ token: 'token-account' });
    // The old transport is gone, not merely idle.
    expect(created[0].connected).toBe(false);
  });

  it('does not rebuild when only the display name changes', () => {
    socketMod.socketManager.getSocket();
    auth.setIdentity(identity('u_one', 'token-one'));
    expect(created).toHaveLength(1);

    auth.applyServerProfile({ username: 'achra', displayName: 'Achraf' });
    expect(created).toHaveLength(1);
  });

  it('tears the transport down when the session is cleared', () => {
    socketMod.socketManager.getSocket();
    auth.setIdentity(identity('u_one', 'token-one'));
    expect(created[0].connected).toBe(true);

    auth.clearIdentity();
    expect(created[0].connected).toBe(false);
    expect(socketMod.socketManager.getStatus()).toBe('disconnected');
  });

  it('emits session:sync only for a bound transport', () => {
    socketMod.socketManager.getSocket();
    socketMod.socketManager.syncIdentity();
    expect(created).toHaveLength(0);

    auth.setIdentity(identity('u_one', 'token-one'));
    socketMod.socketManager.syncIdentity();
    expect(created[0].emitted.map((e: any) => e.event)).toContain('session:sync');
  });

  it('off() detaches only the named handler', () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const socket = socketMod.socketManager.getSocket();
    const ha = (p: unknown) => a.push(p);
    const hb = (p: unknown) => b.push(p);
    socket.on('game:error', ha);
    socket.on('game:error', hb);

    auth.setIdentity(identity('u_one', 'token-one'));
    socket.off('game:error', ha);
    created[0].__fire('game:error', { code: 'X' });

    expect(a).toHaveLength(0);
    expect(b).toHaveLength(1);
  });
});
