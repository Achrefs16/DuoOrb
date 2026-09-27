import { io, Socket } from 'socket.io-client';
// Type-only: the protocol package contributes no runtime code here, and
// importing it for values would pull a CommonJS build into the bundle.
import type { ClientToServerEvents, ServerToClientEvents } from '@duoorb/protocol';
import { SERVER_URL } from './config';
import { getIdentity, subscribeIdentity } from './auth';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;
type RawSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type AnyHandler = (...args: never[]) => void;

/**
 * The socket transport is a pure function of the canonical identity.
 *
 * Two problems are solved here, and they are the same problem:
 *
 * 1. socket.io freezes the handshake `query` and `auth` for the life of a
 *    connection. Mutating them on a live socket never took effect, so a
 *    reconnect after a credential change could re-present the PREVIOUS
 *    identity. The raw socket is therefore rebuilt whenever (userId, token)
 *    changes.
 *
 * 2. Every consumer holds the object returned by `getSocket()`. If that
 *    object were the raw socket, a rebuild would silently detach every
 *    listener that was attached before the session existed — which is
 *    exactly what happens on a cold start, where the challenge and
 *    room-invite hooks attach while there is no identity yet.
 *
 * So `getSocket()` returns a stable facade. Listeners are registered once,
 * held in the manager, and replayed onto each new raw socket.
 */
class SocketManager {
  private raw: RawSocket | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<StatusListener>();
  /** The (userId, token) pair the live raw socket was built from. */
  private boundTo: { userId: string; token: string } | null = null;
  private identityWatcher: (() => void) | null = null;
  /** Event handlers registered by consumers, replayed on every rebuild. */
  private handlers = new Map<string, Set<AnyHandler>>();

  private facade: RawSocket;

  constructor() {
    const self = this;
    // Only the surface consumers actually use. Anything else must go through
    // the manager, so there is one place that knows about the raw socket.
    this.facade = {
      on(event: string, handler: AnyHandler) {
        self.addHandler(event, handler);
        return self.facade;
      },
      off(event: string, handler?: AnyHandler) {
        self.removeHandler(event, handler);
        return self.facade;
      },
      emit(event: string, ...args: unknown[]) {
        (self.raw as unknown as { emit: (e: string, ...a: unknown[]) => void } | null)?.emit(
          event,
          ...args
        );
        return self.facade;
      },
      connect() {
        self.ensureConnected();
        return self.facade;
      },
      disconnect() {
        self.disconnect();
        return self.facade;
      },
      get connected() {
        return self.raw?.connected ?? false;
      },
    } as unknown as RawSocket;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(status: ConnectionStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(this.status);
      } catch (e) {
        console.error('Error in socket status listener', e);
      }
    }
  }

  private addHandler(event: string, handler: AnyHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    this.raw?.on(event as never, handler as never);
  }

  private removeHandler(event: string, handler?: AnyHandler): void {
    if (!handler) {
      this.handlers.delete(event);
      this.raw?.off(event as never);
      return;
    }
    this.handlers.get(event)?.delete(handler);
    this.raw?.off(event as never, handler as never);
  }

  private bindIdentityWatcher(): void {
    if (this.identityWatcher) return;
    this.identityWatcher = subscribeIdentity(() => this.syncWithIdentity());
  }

  /**
   * Reconciles the transport with the canonical identity.
   *
   * Called on every identity change and after a token rotation. Rebuilds when
   * the account or credential actually changed, so a reconnect can never
   * reintroduce a previous identity. With no session at all, the transport is
   * torn down rather than handshaking as nobody.
   */
  public syncWithIdentity(): void {
    const identity = getIdentity();
    if (!identity || !identity.accessToken) {
      this.disposeRaw();
      this.boundTo = null;
      this.setStatus('disconnected');
      return;
    }

    const next = { userId: identity.userId, token: identity.accessToken };
    if (this.raw && this.boundTo?.userId === next.userId && this.boundTo.token === next.token) {
      // Same account, same credential: the connection is still correct. A
      // changed display name needs no new handshake — `syncIdentity` tells
      // the server to re-read the verified profile.
      return;
    }

    this.disposeRaw();
    this.boundTo = next;
    this.raw = this.buildRaw(identity.userId, identity.displayName, next.token);
    this.raw.connect();
  }

  private disposeRaw(): void {
    if (!this.raw) return;
    // Listeners survive in `this.handlers` and are replayed onto the next
    // transport; clearing them here would silently break every consumer that
    // attached before the session existed.
    this.raw.removeAllListeners();
    this.raw.disconnect();
    this.raw = null;
  }

  private buildRaw(userId: string, displayName: string, token: string): RawSocket {
    this.setStatus('connecting');
    // `displayName` here is ADVISORY ONLY. The server resolves the real name
    // from Postgres for any verified credential and ignores this field; it
    // survives purely as a label for a socket that has not authenticated yet.
    const s: RawSocket = io(SERVER_URL, {
      auth: { token },
      query: { userId, displayName },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    // Replay every consumer handler onto the new transport.
    for (const [event, set] of this.handlers) {
      for (const handler of set) s.on(event as never, handler as never);
    }

    s.on('connect', () => this.setStatus('connected'));

    s.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') this.setStatus('disconnected');
      else this.setStatus('reconnecting');
    });

    s.on('connect_error', (err: Error) => {
      // Auth rejections used to look identical to network drops because the
      // reason was discarded. Log it so "not authenticated" is diagnosable.
      console.warn(`[socket] connect_error: ${err?.message ?? 'unknown'}`);
      this.setStatus('disconnected');
    });

    s.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    s.io.on('reconnect_failed', () => {
      console.warn('[socket] reconnect_failed: giving up, staying disconnected');
      this.setStatus('disconnected');
    });
    s.io.on('reconnect', () => {
      this.setStatus('connected');
      // A transport-level reconnect re-presents the current `auth`. Cover the
      // case where the identity itself changed while we were down.
      this.syncWithIdentity();
    });

    return s;
  }

  private ensureConnected(): void {
    this.bindIdentityWatcher();
    const identity = getIdentity();
    if (!identity || !identity.accessToken) {
      // No session: stay disconnected. Handshaking with an empty credential
      // would create an unverified socket and could mask the real identity
      // arriving moments later.
      this.setStatus('disconnected');
      return;
    }
    if (!this.raw) {
      this.syncWithIdentity();
      return;
    }
    if (!this.raw.connected && this.status !== 'connecting') {
      this.setStatus('connecting');
      this.raw.connect();
    }
  }

  /**
   * Returns the shared socket facade. The object identity is stable for the
   * life of the app; only the transport underneath is replaced.
   */
  public getSocket(): RawSocket {
    this.bindIdentityWatcher();
    this.ensureConnected();
    return this.facade;
  }

  /**
   * Identity changed locally without a reconnect (name edited, profile
   * refreshed): ask the server to re-read our verified profile and refresh
   * its map, room slots and queue entry. No payload — the server trusts
   * nothing client-asserted here.
   */
  public syncIdentity(): void {
    if (!this.raw || !this.boundTo) return;
    this.raw.emit('session:sync');
  }

  /**
   * Asks the server to migrate live state (rooms, seats, queue) from this
   * socket's verified identity to the new credential's identity — no
   * reconnect, no client-asserted ids.
   */
  public adoptSession(token: string): Promise<boolean> {
    const socket = this.getSocket();
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok: boolean) => {
        if (!done) {
          done = true;
          resolve(ok);
        }
      };
      try {
        socket.emit('session:adopt', { newToken: token }, (res) => {
          finish(!!res?.success);
        });
      } catch {
        finish(false);
      }
      setTimeout(() => finish(false), 8000);
    });
  }

  public disconnect(): void {
    this.disposeRaw();
    this.boundTo = null;
    this.setStatus('disconnected');
  }
}

export const socketManager = new SocketManager();
