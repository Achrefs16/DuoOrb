import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@duoorb/protocol';
import { SERVER_URL } from './config';
import { getCurrentUser } from './auth';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;

class SocketManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<StatusListener>();
  // Real JWT when signed in, otherwise null (dev-token fallback is used).
  private overrideToken: string | null = null;
  private lastQueryUserId: string | null = null;

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
        listener(status);
      } catch (e) {
        console.error('Error in socket status listener', e);
      }
    }
  }

  /**
   * Called by the session layer whenever auth changes.
   *
   * A reconnect is only needed when the server has to (re)verify this socket,
   * i.e. when we are going from no credential to a real one. Refreshing a guest
   * access token keeps the same `sub`, so the identity the server already
   * verified is still correct — tearing the socket down for that produced a
   * burst of sub-second connect/disconnect cycles and burned guest-creation
   * quota. The new token is still written to `auth` so the next natural
   * reconnect presents it.
   */
  public updateAuthToken(token: string | null): void {
    const previous = this.overrideToken;
    if (previous === token) return;
    this.overrideToken = token;
    const s = this.socket;
    if (!s) return;
    const user = getCurrentUser();
    s.auth = {
      token: token ?? user.token,
    };
    const wasUnverified = !previous;
    if (s.connected && wasUnverified) {
      this.setStatus('reconnecting');
      s.disconnect();
      s.connect();
    }
  }

  /**
   * Called after sign-in/out changes the canonical user id. Rebuilds the
   * socket so the handshake carries the new id.
   * Token-only changes (no id change) just re-auth the live socket.
   */
  public refreshIdentity(token: string | null): void {
    const user = getCurrentUser();
    if (this.lastQueryUserId === user.userId) {
      this.updateAuthToken(token);
      return;
    }
    this.overrideToken = token;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.lastQueryUserId = user.userId;
    this.setStatus('disconnected');
    this.getSocket();
  }

  /**
   * Identity changed locally (guest minted, name chosen/edited,
   * sign-in/out) without a reconnect: ask the server to re-read our
   * verified profile and refresh its map, room slots and queue entry.
   * No payload — the server trusts nothing client-asserted here.
   */
  public syncIdentity(): void {
    const s = this.socket;
    if (!s) return;
    s.emit('session:sync');
  }

  /**
   * Asks the server to migrate live state (rooms, seats, queue) from this
   * socket's verified identity to the new credential's identity — no
   * reconnect, no client-asserted ids. Returns true when the server moved
   * (or there was nothing to move).
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

  private currentAuthToken(): string {
    if (this.overrideToken) return this.overrideToken;
    return getCurrentUser().token;
  }

  /**
   * Returns the shared Socket.IO client instance, initializing it if necessary.
   */
  public getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) {
      if (!this.socket.connected && this.status === 'disconnected') {
        this.setStatus('connecting');
        this.socket.connect();
      }
      return this.socket;
    }

    const user = getCurrentUser();
    this.setStatus('connecting');

    // displayName here is ADVISORY ONLY. The server resolves the real name
    // from Postgres for any verified credential and ignores this field; it
    // survives purely as a label for a socket that has not authenticated yet.
    //
    // It is captured once because socket.io fixes the handshake query for the
    // life of the connection, and rebuilding it would mean a reconnect on every
    // rename. That is precisely why it must not be trusted: while the server
    // did trust it, a rename never reached the socket, the stale value was
    // snapshotted by matchmaking and frozen into the game, and the same player
    // appeared under different names in the friend list and in every match.
    const query: Record<string, string> = {
      userId: user.userId,
      displayName: user.displayName,
    };
    this.lastQueryUserId = user.userId;

    const s: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL, {
      auth: {
        token: this.currentAuthToken(),
      },
      query,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      this.setStatus('connected');
    });

    s.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        this.setStatus('disconnected');
      } else {
        this.setStatus('reconnecting');
      }
    });

    s.on('connect_error', (err: Error) => {
      // Auth rejections used to look identical to network drops because the
      // reason was discarded. Log it so "not authenticated" is diagnosable.
      console.warn(`[socket] connect_error: ${err?.message ?? 'unknown'}`);
      this.setStatus('disconnected');
    });

    s.io.on('reconnect_attempt', () => {
      this.setStatus('reconnecting');
    });

    s.io.on('reconnect_failed', () => {
      // Retries exhausted: surface it instead of sticking forever on a
      // stale "reconnecting" state with no further attempts coming.
      console.warn('[socket] reconnect_failed: giving up, staying disconnected');
      this.setStatus('disconnected');
    });

    s.io.on('reconnect', () => {
      this.setStatus('connected');
    });

    this.socket = s;
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.setStatus('disconnected');
    }
  }
}

export const socketManager = new SocketManager();
