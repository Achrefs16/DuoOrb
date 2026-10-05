import {
  GameAction,
  GameError,
  GameErrorCode,
  GameMode,
  GameState,
  RecordedAction,
} from '@duoorb/game-core';

export interface UserProfileDto {
  id: string;
  username: string;
  displayName: string;
  rating1v1: number;
  rating4p: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  createdAt: number;
  isOnline?: boolean;
  isPlaying?: boolean;
}

export interface FriendDto {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  status: 'ONLINE' | 'PLAYING' | 'OFFLINE';
}

export interface FriendRequestDto {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  createdAt: number;
}

export interface RoomSlot {
  index: number;
  userId: string | null;
  displayName: string | null;
  isReady: boolean;
  isHost: boolean;
  rating?: number;
}

export interface RoomDto {
  id: string;
  code: string;
  mode: GameMode;
  hostId: string;
  /** Original creator — host is restored to them if they rejoin. */
  creatorId: string;
  slots: RoomSlot[];
  timeControlMinutes: number; // 0 for untimed, 3, 5, 10
  incrementSeconds: number;   // 0 for none, 1, 2, 5, etc.
  wallsEach: number;          // walls per player for the room's game
  status: 'WAITING' | 'STARTING' | 'IN_GAME';
  createdAt: number;
}

export interface ClockStateDto {
  activePlayerIndex: number;
  remainingMs: Record<string, number>;
  serverTimestamp: number;
  incrementSeconds?: number;
}

export interface RoomInviteDto {
  inviteId: string;
  roomId: string;
  code: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  createdAt: number;
  /** Server expiry: invites die silently instead of piling up. */
  expiresAt: number;
}

export interface ChallengeDto {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  mode: GameMode;
  timeControlMinutes: number;
  incrementSeconds: number;
  wallsEach: number;
  createdAt: number;
  expiresAt: number;
}

export interface GameEndedDto {
  gameId: string;
  winnerId: string | null;
  /**
   * Why the game ended.
   *
   * `AFK` is deliberately distinct from `TIMEOUT`: that is the chess clock
   * running out, while this is a CONNECTED player sitting on their turn past
   * the inactivity limit. The client shows a different message and card
   * state for each, so they cannot be collapsed into one reason.
   */
  reason: 'GOAL_REACHED' | 'RESIGNATION' | 'TIMEOUT' | 'DISCONNECT' | 'AFK';
  endedAt: number;
  ratingChanges?: Record<string, { before: number; after: number; delta: number }>;
  /** Complete final ordering for multiplayer (1-based places). 1v1 omits it. */
  placements?: { playerId: string; userId: string; place: number }[];
}

export interface GameSyncDto {
  state: GameState;
  clock: ClockStateDto;
  missingActions: RecordedAction[];
  playerUserIds?: Record<string, string>;
  /**
   * UserIds holding effective premium at game creation (P5.2 seat/GameOver
   * badges). FROZEN for the match — a mid-match subscription appears from the
   * next game, so badges never pop in late and shift card layout. Absent on
   * old servers = no badges, never an error.
   */
  premiumUserIds?: string[];
  /**
   * The seat THIS socket is sitting in, resolved by the server from the
   * verified token. The client must use this rather than searching
   * `playerUserIds` for its own id: that comparison was made against a
   * possibly stale local id, which left `onlinePlayerId` null and the board
   * stuck behind a "Connecting to match" overlay while moves still arrived.
   */
  you?: string | null;
  /**
   * Current turn's inactivity deadline, when one applies AND the notice
   * delay has elapsed. A client that attaches (or re-attaches) mid-turn
   * missed the one-shot `game:afkWarning`, so it derives the same card
   * countdown from this instead — but only once the countdown would
   * surface live (early attachers get null, then the broadcast).
   */
  afk?: { playerId: string; afkEndsAt: number } | null;
  /**
   * Seats currently inside a disconnect grace window, with the SERVER's
   * reconnect deadline each. A client (re)attaching after missing the
   * one-shot `game:opponentDisconnected` derives the same card countdowns
   * from this — including its OWN seat, whose deadline the returnee is
   * racing but could otherwise never see. Absent when no seat is away.
   */
  grace?: { userId: string; playerId: string; graceEndsAt: number }[];
}

/**
 * Direct answer to a `game:action` submit: the recorded move on success,
 * the engine's rejection otherwise. Sent to the submitting socket only, and
 * before the room broadcast, so the mover is never gated on fan-out.
 */
export type ActionAck =
  | { ok: true; recorded: RecordedAction }
  /** Same code union as the `game:error` broadcast, so the client handles both with one path. */
  | { ok: false; code: GameErrorCode; message: string };

export interface ClientToServerEvents {
  'game:ping': (
    payload: { gameId: string; clientSentAt: number },
    ack: (res: { serverTimestamp: number; clientSentAt: number }) => void
  ) => void;
  'game:join': (payload: {
    gameId: string;
    lastSequence?: number;
    /** Client's unconfirmed tail for reconnect reconciliation (capped). */
    pendingActions?: { clientActionId: string; action: GameAction }[];
  }) => void;
  'game:leave': (payload: { gameId: string }) => void;
'game:action': (
    payload: {
      gameId: string;
      action: GameAction;
      clientTimestamp: number;
      /** Client-generated idempotency key - retries with the same key replay the original result. */
      clientActionId?: string;
      /** Client's view of the next sequence - enforced when present. */
      expectedSequence?: number;
    },
    /**
     * Direct ack to the sender, answered as soon as the move is validated —
     * before the room broadcast. The mover's board unblocks on this, so a
     * slow fan-out to the other seats never stalls the player who moved.
     * Idempotent with the `game:actionAccepted` echo: applying both is safe.
     */
    ack?: (result: ActionAck) => void
  ) => void;
  'session:adopt': (
    payload: { newToken: string },
    callback?: (res: { success: boolean; userId?: string; error?: string }) => void
  ) => void;
  /**
   * Identity changed client-side (guest minted, username/display name
   * chosen or edited, sign-in/out). No payload: the server re-reads the
   * verified identity it already holds and refreshes its map, room slots
   * and queue entries from the profile — never from client strings.
   */
  'session:sync': () => void;
  'game:resign': (payload: { gameId: string }) => void;  'game:rematch': (payload: { gameId: string }) => void;
  /**
   * Explicit rematch decline. Without it a dismissed offer lived out its full
   * server TTL while the offeror waited — the decline lets the other side
   * stop waiting now.
   */
  'game:rematchDecline': (payload: { gameId: string }) => void;
  /**
   * Ephemeral quick reaction. Validated kinds are enforced server-side;
   * anything outside them is dropped, never stored, never sequenced.
   */
  'game:reaction': (payload: { gameId: string; reaction: string }) => void;
  'room:create': (payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }, callback: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  'room:join': (payload: { code: string }, callback: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  'room:ready': (payload: { roomId: string; isReady: boolean }) => void;
  /**
   * Host-only setup edit (mode/clock/walls) from a WAITING lobby. Returns
   * the updated room; every member also gets it via room:state broadcast.
   */
  'room:configure': (
    payload: { roomId: string; mode?: GameMode; timeControlMinutes?: number; incrementSeconds?: number; wallsEach?: number },
    callback?: (res: { success: boolean; room?: RoomDto; error?: string }) => void
  ) => void;
  'room:start': (payload: { roomId: string }) => void;
  'room:leave': (payload: { roomId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:kick': (payload: { roomId: string; userId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:invite': (payload: { roomId: string; toUserId: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'room:inviteRespond': (payload: { inviteId: string; accept: boolean }, callback?: (res: { success: boolean; room?: RoomDto; error?: string }) => void) => void;
  /** Pull the room's authoritative state. Used when re-entering a lobby from
   * a finished match, where the client only holds a pre-match snapshot. */
  'room:sync': (payload: { roomId?: string; code?: string }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'matchmaking:find': (payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }) => void;
  'matchmaking:cancel': () => void;
  /**
   * Presence heartbeat (ONLINE_HEALTH C1): verified sockets ping at most
   * every ~60s so `updatedAt` stays fresh while the app is open. The 5-minute
   * freshness rule therefore only ever demotes killed apps and dead
   * connections — never a live, idle lobby sitter. Throttled server-side.
   */
  'presence:ping': () => void;
  'challenge:send': (payload: { toUserId: string; mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }, callback?: (res: { success: boolean; challenge?: ChallengeDto; error?: string }) => void) => void;
  'challenge:respond': (payload: { challengeId: string; accept: boolean }, callback?: (res: { success: boolean; error?: string }) => void) => void;
  'challenge:cancel': (payload: { challengeId: string }) => void;
}

export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:actionAccepted': (recorded: RecordedAction) => void;
  'game:clock': (clock: ClockStateDto) => void;
  'game:ended': (result: GameEndedDto) => void;
  /** Mid-game finish: a player earned a placement but the match continues. */
  'game:playerFinished': (payload: { gameId: string; playerId: string; userId: string; place: number }) => void;
  'game:error': (error: GameError) => void;
  'game:opponentDisconnected': (payload: {
    userId: string;
    /** Seat of the player who dropped, so 3P/4P clients can say whose it is. */
    playerId?: string;
    gracePeriodSeconds: number;
    /**
     * SERVER's deadline for the reconnect window. The client counts down to
     * this instead of decrementing its own copy, so a throttled or
     * backgrounded phone cannot show a grace period the server will not honour.
     */
    graceEndsAt: number;
  }) => void;
  'game:opponentReconnected': (payload: {
    userId: string;
    /** Seat of the player who came back. */
    playerId?: string;
  }) => void;
  'game:sync': (sync: GameSyncDto) => void;
  /**
   * Inactivity notice for the seat on turn. Fires after 15s of stillness, not
   * at the turn start — the countdown IS the warning, shown on that seat's
   * card, and the player sitting in it must see their own. At emission the
   * remainder is ~30s of a 45s allowance (shorter for banked remainders).
   * Distinct from `game:opponentDisconnected`: that seat is connected and
   * simply not moving, and the client shows a different state for it.
   * `afkEndsAt` is the SERVER's forfeit deadline; the client counts down to
   * it instead of decrementing its own copy. `secondsRemaining` is the same
   * allowance expressed once, for the first paint.
   */
  'game:afkWarning': (payload: { playerId?: string; afkEndsAt: number; secondsRemaining: number }) => void;
  /** The inactivity notice no longer applies (that seat moved, or left). */
  'game:afkCleared': (payload: { playerId?: string }) => void;
  'game:rematchOffered': (payload: { gameId: string; fromUserId: string }) => void;
  /** Someone dismissed the rematch offer: stop waiting, stay on the result. */
  'game:rematchDeclined': (payload: { gameId: string; byUserId: string }) => void;
  /** Relay of another seat's quick reaction. Ephemeral: render and forget. */
  'game:reaction': (payload: { gameId: string; reaction: string; fromUserId: string }) => void;
  'room:state': (room: RoomDto) => void;
  'room:started': (payload: { roomId: string; gameId: string }) => void;
  'room:kicked': (payload: { roomId: string }) => void;
  'room:inviteReceived': (invite: RoomInviteDto) => void;
  'room:inviteDeclined': (payload: { inviteId: string; byUserId: string }) => void;
  'matchmaking:matched': (payload: {
    gameId: string;
    roomId?: string;
    /** Everyone else seated in the match, for the opponent-found card. */
    opponents?: Array<{ userId: string; displayName: string; rating: number }>;
  }) => void;
  'challenge:received': (challenge: ChallengeDto) => void;
  'challenge:accepted': (payload: { challengeId: string; gameId: string; mode: GameMode; timeControlMinutes: number; incrementSeconds: number }) => void;
  'challenge:declined': (payload: { challengeId: string; byUserId: string }) => void;
  'challenge:expired': (payload: { challengeId: string }) => void;
  'challenge:cancelled': (payload: { challengeId: string }) => void;
  /**
   * This socket was superseded: the same account connected elsewhere, which
   * is now the single controlling session. The old tab must stand down
   * (it would otherwise miss every direct and half-act on stale state).
   */
  'session:superseded': () => void;
  /**
   * Handshake verdict for THIS socket (ONLINE_HEALTH Phase A). The transport
   * connects even with an expired credential; only this event tells the
   * client whether the server recognized it. Clients must treat connected +
   * unverified as offline-with-retry, never as healthy.
   */
  'session:authState': (payload: { verified: boolean; userId: string }) => void;
  /**
   * Live online-player count, broadcast on verified connect/disconnect
   * (same 5-minute freshness rule as GET /presence/online). Clients use it
   * instantly and keep the REST poll as backup.
   */
  'presence:count': (payload: { count: number }) => void;
}
