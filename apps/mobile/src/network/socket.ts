import { io, Socket } from 'socket.io-client';
// Type-only: the protocol package contributes no runtime code here, and
// importing it for values would pull a CommonJS build into the bundle.
import type { ClientToServerEvents, ServerToClientEvents } from '@duoorb/protocol';
import { useSyncExternalStore } from 'react';
import { SERVER_URL } from './config';
import { getIdentity, subscribeIdentity } from './auth';
import { isTokenFresh } from './tokenFreshness';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

/** A queued intent the transport discarded instead of sending. */
export interface DroppedIntent {
  event: string;
  gameId?: string;
  clientActionId?: string;
}

function toDroppedIntent(event: string, args: unknown[]): DroppedIntent {
  const first = args[0] as { gameId?: unknown; clientActionId?: unknown } | undefined;
  const out: DroppedIntent = { event };
  if (typeof first?.gameId === 'string') out.gameId = first.gameId;
  if (typeof first?.clientActionId === 'string') out.clientActionId = first.clientActionId;
  return out;
}

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
 * Quiet period after socket.io gives up (15 failed attempts): the transport
 * stays down instead of being re-cranked by every join tick, which used to
 * restart fresh 15-burst loops forever on a dead server (battery + load).
 * Re-armed by a real signal only: NetInfo back online, a new scoped game, an
 * explicit retryNow(), a credential rebuild, or a successful connect.
 */
const RECONNECT_COOLDOWN_MS = 45000;

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
   * When socket.io exhausted its attempts. ensureConnected() will not crank
   * the transport again until RECONNECT_COOLDOWN_MS passes or a re-arm
   * signal arrives (see above). Null means no give-up is in effect.
   */
  private giveUpAt: number | null = null;
  /**
   * Emits waiting for a transport: joins, leaves and moves only, max 20,
   * 30s TTL. Everything else (presence, reactions, probes) is stale by the
   * time the transport returns and is dropped, never queued.
   */
  private emitQueue: { event: string; args: unknown[]; at: number }[] = [];
  private netWatched = false;
  /**
   * Last OS link verdict: true after an explicit offline report, false after
   * an online one. Lets the UI say "You're offline" instead of a generic
   * "Reconnecting…" while the transport is down for a known-dead link.
   */
  private linkDown = false;
  private linkListeners = new Set<(down: boolean) => void>();
  /**
   * Server-confirmed authentication (ONLINE_HEALTH Phase A): true only after
   * the server emits session:authState{verified:true} for THIS transport.
   * Transport `connected` without verified=true is the ghost state — the
   * lobby must render it as offline-with-retry, never as healthy.
   * Null = unknown (never handshaked, or transport rebuilt).
   */
  private verified: boolean | null = null;
  private verifiedListeners = new Set<(verified: boolean | null) => void>();
  /** Refresh in flight (reconnect race + explicit retry share it). */
  private refreshInFlight: Promise<boolean> | null = null;
  /**
   * Intents the queue silently discarded: cap overflow (oldest shifted out)
   * or TTL expiry (older than 30s at flush). Deliberate routing drops
   * (stale leaves, cross-game scope) are NOT reported — only genuine
   * losses, so the game channel can roll the optimistic tail back instead
   * of rendering a move that will never send.
   */
  private dropListeners = new Set<(dropped: DroppedIntent[]) => void>();

  /** Subscribe to silent queue losses. Returns the unsubscribe. */
  public subscribeDrops(fn: (dropped: DroppedIntent[]) => void): () => void {
    this.dropListeners.add(fn);
    return () => {
      this.dropListeners.delete(fn);
    };
  }

  private notifyDrops(dropped: DroppedIntent[]): void {
    if (dropped.length === 0) return;
    for (const fn of this.dropListeners) {
      try {
        fn(dropped);
      } catch {
        // One bad listener must not break the rest.
      }
    }
  }
  /** Server-confirmed auth for THIS transport (see field). Null = unknown. */
  public isVerified(): boolean | null {
    return this.verified;
  }

  /** Subscribe to verified changes. Fires immediately with current value. */
  public subscribeVerified(fn: (verified: boolean | null) => void): () => void {
    this.verifiedListeners.add(fn);
    try {
      fn(this.verified);
    } catch {
      // One bad listener must not break the rest.
    }
    return () => {
      this.verifiedListeners.delete(fn);
    };
  }

  private setVerified(verified: boolean | null): void {
    if (this.verified === verified) return;
    this.verified = verified;
    for (const fn of this.verifiedListeners) {
      try {
        fn(this.verified);
      } catch {
        // One bad listener must not break the rest.
      }
    }
  }

  /** Current OS link verdict (see above). */
  public isLinkDown(): boolean {
    return this.linkDown;
  }

  /**
   * Refreshes the access credential when it is expired or dying, then reports
   * whether play can continue. Guest path rotates via the shared single-flight
   * refresh (apiClient); account path re-reads the live Supabase session
   * (which auto-refreshes). Dynamic imports keep apiClient's socketManager
   * import from becoming a module-cycle. Shared in-flight so a reconnect race
   * and an explicit retry rotate exactly once.
   */
  public refreshCredential(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        try {
          const identity = getIdentity();
          if (!identity) return false;
          if (isTokenFresh(identity.accessToken)) return true;
          if (identity.isGuest) {
            const { refreshSessionOnce } = await import('./apiClient');
            return refreshSessionOnce();
          }
          try {
            const { getSupabaseAuth } = await import('../lib/supabase');
            const { data, error } = await getSupabaseAuth().getSession();
            if (error || !data.session?.access_token) return false;
            const { patchIdentity: patch } = await import('./auth');
            patch({ accessToken: data.session.access_token });
            return true;
          } catch {
            return false;
          }
        } catch {
          return false;
        } finally {
          this.refreshInFlight = null;
        }
      })();
    }
    return this.refreshInFlight;
  }

  /** Subscribe to OS link verdict changes. Returns the unsubscribe. */
  public subscribeLink(fn: (down: boolean) => void): () => void {
    this.linkListeners.add(fn);
    return () => {
      this.linkListeners.delete(fn);
    };
  }

  private setLinkDown(down: boolean): void {
    if (this.linkDown === down) return;
    this.linkDown = down;
    for (const fn of this.linkListeners) {
      try {
        fn(down);
      } catch {
        // One bad listener must not break the rest.
      }
    }
  }
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
    if (gameId !== this.scopedGameId) {
      // A new match is a fresh start: a give-up from the previous game must
      // not gate this one's connects for the remainder of the cooldown.
      this.giveUpAt = null;
    }
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
          // Cap overflow discards the OLDEST intents — genuinely lost, so
          // report them for optimistic rollback instead of rendering moves
          // that will never send.
          if (self.emitQueue.length > 20) {
            const lost = self.emitQueue.splice(0, self.emitQueue.length - 20);
            self.notifyDrops(lost.map((q) => toDroppedIntent(q.event, q.args)));
          }
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
    const expired = this.emitQueue.filter((q) => now - q.at > 30000);
    this.notifyDrops(expired.map((q) => toDroppedIntent(q.event, q.args)));
    const due = this.emitQueue.filter((q) => now - q.at <= 30000);
    this.emitQueue = [];
    if (!this.raw?.connected) return;
    // Join-owns-tail: a game:action carrying an idempotency key is part of
    // the channel's pending tail, which every game:join in this batch
    // resubmits. Flushing both double-submits (safe only by server dedupe);
    // the join alone suffices. Keyless actions (legacy/raw emits outside
    // any tail) still flush exactly as before.
    const joinedGames = new Set(
      due
        .filter((q) => q.event === 'game:join')
        .map((q) => (q.args[0] as { gameId?: unknown } | undefined)?.gameId)
    );
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
      // Join-owns-tail (see above): skip the keyed action, the join in this
      // batch carries it.
      if (q.event === 'game:action' && typeof scopedTo === 'string' && joinedGames.has(scopedTo)) {
        const key = (q.args[0] as { clientActionId?: unknown } | undefined)?.clientActionId;
        if (typeof key === 'string' && key.length > 0) {
          console.warn(`[socket] join owns the tail: skipping queued game:action for ${scopedTo}`);
          continue;
        }
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
      // A new credential also retries freely: any previous auth rejection
      // belonged to the old one, so authDead dies with it. Without this a
      // 401 followed by a successful refresh stayed offline until restart.
      this.boundTo = next;
      this.authDead = false;
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
    this.giveUpAt = null;
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
    // A new transport has proven nothing yet: verified resets to unknown so
    // the UI cannot display the previous session's health as this one's.
    this.setVerified(null);
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
      transports: ['websocket'],
    });

    // Replay every consumer handler onto the new transport.
    for (const [event, set] of this.handlers) {
      for (const handler of set) s.on(event as never, handler as never);
    }

    s.on('connect', () => {
      this.setStatus('connected');
      // A live connection proves the credential and the server at once.
      this.authDead = false;
      this.giveUpAt = null;
      this.flushQueue();
      // NOTE: verified is NOT set here — only session:authState (below) may
      // set it. A transport that handshook with an expired token connects
      // fine and stays unverified; marking verified on connect is exactly
      // the ghost-online bug.
    });

    // Server handshake verdict (ONLINE_HEALTH Phase A): the ONLY writer of
    // verified. true = recognized identity, presence set server-side.
    // false = connected stranger — re-auth and re-handshake, don't linger.
    s.on('session:authState', (state: { verified?: unknown } | undefined) => {
      if (state?.verified === true) {
        this.lastReauthToken = null;
        this.setVerified(true);
        return;
      }
      this.setVerified(false);
      void this.reauthAndReconnect();
    });

    // Superseded: this account connected elsewhere, which is now the single
    // controlling session. Standing down (instead of lingering half-dead,
    // missing directs and acting on stale boards) is the honest move.
    s.on('session:superseded', () => {
      console.warn('[socket] superseded: same account connected elsewhere, standing down');
      void import('../components/AppToast')
        .then((m) => m.toast.show('Signed in on another device. This session disconnected.'))
        .catch(() => {});
      this.disconnect();
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
        // Guest-aware copy: guests have no sign-in to go to.
        void import('../components/AppToast')
          .then((m) =>
            m.toast.show(
              getIdentity()?.isGuest === false
                ? 'Session expired, sign in again.'
                : 'Session expired. Restart to play again.'
            )
          )
          .catch(() => {});
      } else {
        this.setStatus('reconnecting');
      }
    });

    s.io.on('reconnect_attempt', () => {
      this.setStatus('reconnecting');
      // Refresh-first reconnect (Phase A): socket.io fires the attempt
      // immediately, so this only warms the NEXT handshake — the manager
      // updates raw.auth in place, which v4 presents on subsequent attempts.
      // With 15 attempts sharing backoff, a stale token converges to fresh
      // within a few tries instead of handshaking dead 15 times.
      void this.refreshCredential().then((ok) => {
        if (!ok) return;
        const identity = getIdentity();
        if (identity && this.raw) {
          try {
            (this.raw as unknown as { auth: unknown }).auth = {
              token: identity.accessToken,
            };
          } catch {
            // Non-fatal: the next full rebuild picks the credential up.
          }
        }
      });
    });
    s.io.on('reconnect_failed', () => {
      console.warn('[socket] reconnect_failed: cooling down, transport stays down');
      this.giveUpAt = Date.now();
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
          // A captive portal (connected, not reachable) is NOT online:
          // treating it as online used to hammer connect() against a login
          // page. Unknown reachability (null) is trusted — only an explicit
          // false arms the teardown.
          const online =
            s.isConnected === true && s.isInternetReachable !== false;
          const offline =
            s.isConnected === false || s.isInternetReachable === false;
          if (offline) {
            this.setLinkDown(true);
            // Wait out the blip: socket.io's own heartbeat/retry reports
            // the truth meanwhile, and a quick recovery cancels this with
            // the transport (and its retry budget) intact.
            if (this.offlineTimer) return;
            this.offlineTimer = setTimeout(() => {
              this.offlineTimer = null;
              this.disposeRaw();
              this.setStatus('disconnected');
            }, OFFLINE_TEARDOWN_MS);
          } else if (online) {
            this.setLinkDown(false);
            if (this.offlineTimer) {
              clearTimeout(this.offlineTimer);
              this.offlineTimer = null;
            }
            // A real network signal re-arms everything: post-give-up
            // cooldown included. This is what lets a dead-server error
            // recover without an app restart when the link returns.
            this.giveUpAt = null;
            this.syncWithIdentity();
            this.ensureConnected();
          }
        });
      })
      .catch(() => {
        // No NetInfo here: socket still works, just without offline gating.
        console.warn('[socket] NetInfo unavailable: offline gating disabled');
      });
  }

  /**
   * Unverified-transport recovery (Phase A): the server just told us this
   * connection handshook as a stranger. Refresh the credential; on success
   * tear down and rebuild so the NEXT handshake presents it (updating auth
   * on a live-but-unverified socket never re-verifies it). On failure the
   * credential is dead: park in authDead with a visible disconnected state
   * and let the user retry or re-sign-in — never linger as a ghost.
   */
  private reauthInFlight: Promise<void> | null = null;
  /**
   * Token the last reauth rebuilt with. If the server rejects the SAME token
   * twice in a row (revoked server-side, wiped DB), rebuilding again is a
   * loop — park instead. Cleared on any verified handshake.
   */
  private lastReauthToken: string | null = null;

  private reauthAndReconnect(): void {
    if (this.reauthInFlight) return;
    this.reauthInFlight = (async () => {
      const ok = await this.refreshCredential();
      const token = getIdentity()?.accessToken ?? null;
      if (ok && token && token !== this.lastReauthToken) {
        // Rebuild (not merely re-auth): only a new handshake re-verifies.
        this.lastReauthToken = token;
        this.disposeRaw();
        this.syncWithIdentity();
        this.ensureConnected();
      } else {
        // Dead credential, or the same credential rejected twice: tear down
        // the stranger-transport (the server ignores everything it sends)
        // and park with a visible state + retry path instead of looping.
        // disposeRaw resets verified to unknown; re-assert false so the UI
        // keeps showing the expired-session state, not a loading shimmer.
        this.lastReauthToken = null;
        this.authDead = true;
        this.disposeRaw();
        this.setVerified(false);
        this.setStatus('disconnected');
        void import('../components/AppToast')
          .then((m) =>
            m.toast.show(
              getIdentity()?.isGuest === false
                ? 'Session expired, sign in again.'
                : 'Session expired. Restart to play again.'
            )
          )
          .catch(() => {});
      }
    })().finally(() => {
      this.reauthInFlight = null;
    });
    void this.reauthInFlight;
  }

  /**
   * Explicit user retry (e.g. the Home pill or a "try again" affordance):
   * drops any post-give-up cooldown AND any dead-credential park, cranks the
   * transport NOW with the current credential, and refreshes in parallel —
   * whichever wins. A truly dead credential re-parks on the next failure
   * (authState → reauth), so one explicit tap can never start a storm.
   */
  public retryNow(): void {
    this.giveUpAt = null;
    this.authDead = false;
    this.ensureConnected();
    void this.refreshCredential();
  }

  /**
   * App-foreground revalidation (Phase C): refresh a dying credential, revive
   * a dead transport, and let the screens' own polls converge on data. Called
   * from the single App-level AppState listener — screens keep no socket
   * timers of their own.
   */
  public foregroundRevalidate(): void {
    void this.refreshCredential().finally(() => {
      this.syncWithIdentity();
      this.ensureConnected();
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
    // Post-give-up cooldown: the join tick is not allowed to restart burst
    // loops on a dead server. Re-armed by NetInfo, retryNow(), a rebuild, a
    // new scoped game, or a successful connect — never by the tick itself.
    if (this.giveUpAt !== null && Date.now() - this.giveUpAt < RECONNECT_COOLDOWN_MS) {
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
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    this.disposeRaw();
    this.boundTo = null;
    this.lastReauthToken = null;
    // Explicit teardown drops queued intents with the session they belong to.
    this.emitQueue = [];
    // A fresh session starts with a clean slate: no stale give-up gating it.
    this.giveUpAt = null;
    this.setStatus('disconnected');
  }
}

export const socketManager = new SocketManager();

/**
 * Live verified flag for indicators. Screens must render verified (not
 * transport-connected) as the health signal: connected + unverified is the
 * ghost state and must look offline-with-retry, never healthy.
 */
export function useVerified(): boolean | null {
  return useSyncExternalStore(
    (fn) => socketManager.subscribeVerified(fn),
    () => socketManager.isVerified(),
    () => socketManager.isVerified()
  );
}
