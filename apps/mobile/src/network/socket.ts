import { io, Socket } from 'socket.io-client';
// Type-only: the protocol package contributes no runtime code here, and
// importing it for values would pull a CommonJS build into the bundle.
import type { ClientToServerEvents, ServerToClientEvents } from '@duoorb/protocol';
import { SERVER_URL } from './config';
import { getIdentity, subscribeIdentity } from './auth';
import { COPY } from './errors';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;
type RawSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type AnyHandler = (...args: never[]) => void;

/**
 * Events that may be buffered while the socket is down and replayed after it
 * comes back — an explicit allowlist, because a substring test once matched
 * `game:leave` and turned a queued forfeit into a replayed one.
 *
 * Note what is NOT here: matchmaking and room requests. Both are answered by a
 * fresh server-side snapshot (`matchmaking:matched` / `room:state`), so
 * replaying them would duplicate queue entries and lobby state instead of
 * recovering anything.
 */
const QUEUEABLE_EVENTS = new Set<string>([
  'game:join',
  'game:leave',
  'game:action',
  'game:resign',
]);

/**
 * How long the OS must report "no connection" before the transport is torn
 * down. Shorter than socket.io's own give-up horizon (15 attempts over
 * ~45s+), long enough to ride out tunnel/elevator/WiFi-handoff blips that
 * socket.io survives on its own.
 */
const OFFLINE_TEARDOWN_MS = 6000;

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
  /**
   * Credential the server rejected: never retried on its own — only a new
   * identity (which rebuilds through syncWithIdentity and clears this) may
   * reconnect. Without it one dead token would toast every few seconds.
   */
  private authDead = false;
  /**
   * Emits waiting for a transport: joins, leaves and moves only, max 20,
   * 30s TTL. Everything else (presence, reactions, probes) is stale by the
   * time the transport returns and is dropped, never queued.
   */
  private emitQueue: { event: string; args: unknown[]; at: number }[] = [];
  private netWatched = false;
  /**
   * Game the app is currently in, set by the online channel. Queue replay
   * is scoped to it: a move or join for a PREVIOUS game flushed after a
   * rematch switch would otherwise land in the new game (STALE_SEQUENCE at
   * best, a rolled-back pending tail at worst). Null means unknown — flush
   * everything, the pre-scoping behaviour.
   */
  private scopedGameId: string | null = null;

  /** Scopes offline-queue replay to one game (see above). Null clears. */
  public setScopedGame(gameId: string | null): void {
    this.scopedGameId = gameId;
  }

  /** Clears the replay scope, but only if it still names this game. */
  public clearScopedGame(gameId: string): void {
    if (this.scopedGameId === gameId) this.scopedGameId = null;
  }

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
        if (self.raw?.connected) {
          (self.raw as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
            event,
            ...args
          );
        } else if (self.isQueueable(event)) {
          self.emitQueue.push({ event, args, at: Date.now() });
          while (self.emitQueue.length > 20) self.emitQueue.shift();
        }
        // Anything else emitted while down is dropped, not queued.
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
   * The ONLY events that survive a disconnect.
   *
   * An explicit list, never a substring match: the old `/join|leave|move/i`
   * test matched by accident, which is how `game:leave` — a FORFEIT — ended
   * up replayable. A queued leave belongs to the game it was pressed in;
   * flushing it into whatever game the socket has since joined hands the new
   * opponent a free win. Everything outside this list is dropped while down.
   */
  private isQueueable(event: string): boolean {
    return QUEUEABLE_EVENTS.has(event);
  }

  /** Replays queued emits younger than 30s, in order. */
  private flushQueue(): void {
    if (this.emitQueue.length === 0) return;
    const now = Date.now();
    const due = this.emitQueue.filter((q) => now - q.at <= 30000);
    this.emitQueue = [];
    if (!this.raw?.connected) return;
    for (const q of due) {
      // A leave that sat in the queue is stale by definition: the socket it
      // was meant for is gone and the player has since moved on. Sending it
      // now would forfeit a live game they never asked to leave. Dropping it
      // is the honest outcome — the server's grace timer handles the seat
      // they actually walked away from.
      if (q.event === 'game:leave') {
        console.warn('[socket] dropped stale queued game:leave');
        continue;
      }
      // Scoped replay: anything addressed to a game we have since left is
      // dropped, never flushed into the current one.
      const scopedTo = (q.args[0] as { gameId?: unknown } | undefined)?.gameId;
      if (
        this.scopedGameId !== null &&
        typeof scopedTo === 'string' &&
        scopedTo !== this.scopedGameId
      ) {
        console.warn(`[socket] dropped queued ${q.event} for a previous game`);
        continue;
      }
      try {
        (this.raw as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
          q.event,
          ...q.args
        );
      } catch {
        break;
      }
    }
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

    if (this.raw && this.boundTo?.userId === next.userId) {
      // Pure credential rotation (guest token refresh): same account, new
      // token. Tearing the transport down here would drop a live match into
      // a grace window for no reason — the live handshake keeps working,
      // and socket.io presents the updated `auth` on the next (re)connect.
      this.boundTo = next;
      try {
        (this.raw as unknown as { auth: unknown }).auth = { token: next.token };
      } catch {
        // Non-fatal: the next full rebuild picks the credential up.
      }
      return;
    }

    this.disposeRaw();
    this.boundTo = next;
    // A new credential retries freely: any previous auth rejection belonged
    // to the old one.
    this.authDead = false;
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

    s.on('connect', () => {
      this.setStatus('connected');
      this.flushQueue();
    });

    s.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') this.setStatus('disconnected');
      else this.setStatus('reconnecting');
    });

    s.on('connect_error', (err: Error) => {
      const msg = err?.message ?? 'unknown';
      console.warn(`[socket] connect_error: ${msg}`);
      if (/401|unauthorized|unauthenticated|authentication failed|invalid (token|session|credential)/i.test(msg)) {
        // Dead credential: stop the retry storm, surface re-auth exactly once.
        // Only a new identity (which rebuilds and clears this flag) retries.
        this.authDead = true;
        try {
          s.disconnect();
        } catch {
          // Already down.
        }
        this.setStatus('disconnected');
        void import('../components/AppToast')
          .then((m) => m.toast.show(COPY.sessionExpired))
          .catch(() => {});
      } else {
        this.setStatus('reconnecting');
      }
    });

    s.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    s.io.on('reconnect_failed', () => {
      console.warn('[socket] reconnect_failed: giving up, staying disconnected');
      this.setStatus('disconnected');
    });
    s.io.on('reconnect', () => {
      this.setStatus('connected');
      this.flushQueue();
      // A transport-level reconnect re-presents the current `auth`. Cover the
      // case where the identity itself changed while we were down.
      this.syncWithIdentity();
    });

    return s;
  }

  /**
   * Offline gate, armed on first connect. A transient blip must NOT tear the
   * transport down: socket.io already retries with backoff, and destroying
   * the socket turns a 2-second radio gap into a full grace-arm / rejoin /
   * replay storm for both seats. Only a SUSTAINED loss (still down after
   * OFFLINE_TEARDOWN_MS) disposes the transport — without burning the retry
   * budget on a link that is already known dead. Lazy import keeps the native
   * module out of module scope so unit tests never pay for it.
   */
  private offlineTimer: ReturnType<typeof setTimeout> | null = null;

  private watchConnectivity(): void {
    if (this.netWatched) return;
    this.netWatched = true;
    void import('@react-native-community/netinfo')
      .then((m) => {
        m.default.addEventListener((s) => {
          if (s.isConnected === false) {
            // Wait out the blip: socket.io's own heartbeat/retry reports
            // the truth meanwhile, and a quick recovery cancels this with
            // the transport (and its retry budget) intact.
            if (this.offlineTimer) return;
            this.offlineTimer = setTimeout(() => {
              this.offlineTimer = null;
              this.disposeRaw();
              this.setStatus('disconnected');
            }, OFFLINE_TEARDOWN_MS);
          } else if (s.isConnected === true) {
            if (this.offlineTimer) {
              clearTimeout(this.offlineTimer);
              this.offlineTimer = null;
            }
            this.syncWithIdentity();
            this.ensureConnected();
          }
        });
      })
      .catch(() => {
        // No NetInfo here: socket still works, just without offline gating.
      });
  }

  private ensureConnected(): void {
    this.watchConnectivity();
    this.bindIdentityWatcher();
    const identity = getIdentity();
    if (!identity || !identity.accessToken) {
      // No session: stay disconnected. Handshaking with an empty credential
      // would create an unverified socket and could mask the real identity
      // arriving moments later.
      this.setStatus('disconnected');
      return;
    }
    // A rejected credential never reconnects on its own.
    if (this.authDead) return;
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
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    this.disposeRaw();
    this.boundTo = null;
    // Explicit teardown drops queued intents with the session they belong to.
    this.emitQueue = [];
    this.setStatus('disconnected');
  }
}

export const socketManager = new SocketManager();
