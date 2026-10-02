import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { GameAction, GameError, GameState, RecordedAction, applyAction } from '@duoorb/game-core';
import { ClockStateDto, GameEndedDto, GameSyncDto } from '@duoorb/protocol';
import { socketManager, ConnectionStatus } from './socket';
import { getIdentity, useIdentity } from './auth';

export interface UseOnlineGameOptions {
  gameId: string;
  /**
   * A sync snapshot captured by the pre-game join gate (matchmaking, lobby,
   * challenge accept). Seeding from it means the board renders on the first
   * frame instead of behind a connecting page; game:join is still emitted on
   * mount to attach the room channel for live events. Null (rematch switch,
   * reconnect) keeps whatever the hook already holds.
   */
  initialSync?: GameSyncDto | null;
  onGameEnded?: (result: GameEndedDto) => void;
  onError?: (error: GameError) => void;
}

/** How often to re-ask the server for game state while still syncing. */
const JOIN_RETRY_MS = 2500;
/** After this many unanswered retries, surface an error instead of spinning. */
const JOIN_ATTEMPT_LIMIT = 8;

function sameAction(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'MOVE' && b.type === 'MOVE') {
    return a.to.row === b.to.row && a.to.col === b.to.col;
  }
  if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL') {
    return (
      a.wall.row === b.wall.row &&
      a.wall.col === b.wall.col &&
      a.wall.orientation === b.wall.orientation
    );
  }
  return true;
}

interface PendingAction {
  clientActionId: string;
  expectedSequence: number;
  action: GameAction;
  /**
   * When the player actually made the move. The optimistic derivation replays
   * with THIS timestamp rather than reading the clock during render: a
   * derivation must be a pure function of (confirmed state, pending tail), and
   * a fresh Date.now() would make it impure and re-shuffle history order on
   * every unrelated re-render.
   */
  clientTimestamp: number;
}

/**
 * Hard cap on the unconfirmed tail. Reconnect resubmits carry at most 20
 * entries server-side, so a longer tail could never be fully replayed and
 * the oldest would be silently lost. Input locking makes this unreachable in
 * normal play; it exists so the failure mode is a refusal, never a truncated
 * history.
 */
const MAX_PENDING = 19;

/**
 * How often the client re-measures latency while a match runs.
 *
 * The estimate feeds the server's clock refund, so it has to track the
 * connection rather than be sampled once at join — a phone moving between
 * wifi and cellular would otherwise keep the stale number. Five seconds is
 * often enough to notice a real change and rare enough to stay invisible.
 */
const LATENCY_PROBE_INTERVAL_MS = 5000;

/**
 * True when a seat-level event is about THIS client's own seat.
 *
 * `game:opponentDisconnected` / `game:opponentReconnected` are about a SEAT,
 * not about "the opponent": on a 3P/4P table another seat dropping matters
 * just as much. Matching on `playerId` — the seat the server resolved, never
 * a client-supplied field — is what stops your own reconnect from arming, or
 * worse cancelling, a forfeit countdown against you.
 *
 * An event with no `playerId` is treated as NOT ours: an unnecessary banner
 * is a smaller failure than hiding a real opponent's absence.
 */
export function isOwnSeatEvent(
  payload: { userId?: string; playerId?: string | null },
  myPlayerId: string | null
): boolean {
  if (!myPlayerId) return false;
  return !!payload.playerId && payload.playerId === myPlayerId;
}

export function useOnlineGame({ gameId, initialSync, onGameEnded, onError }: UseOnlineGameOptions) {
  /**
   * The canonical identity, subscribed. Reading it in a render body used to
   * freeze a snapshot: if the session changed after mount, every later seat
   * lookup compared the server's seats against a dead id, `myPlayerId` stayed
   * null, and the screen sat on "Connecting to match" over a board that was
   * receiving and playing moves normally. Subscribing fixes the staleness;
   * `game:sync.you` below fixes the lookup itself.
   */
  const identity = useIdentity();
  const [gameState, setGameState] = useState<GameState | null>(() => initialSync?.state ?? null);
  const [clocks, setClocks] = useState<Record<string, number>>(() => {
    const seeded: Record<string, number> = {};
    if (initialSync) {
      for (const [pId, ms] of Object.entries(initialSync.clock.remainingMs)) {
        seeded[pId] = Math.ceil(ms / 1000);
      }
    }
    return seeded;
  });
  const [myPlayerId, setMyPlayerId] = useState<string | null>(() => {
    if (!initialSync) return null;
    if (initialSync.you) return initialSync.you;
    const liveUserId = getIdentity()?.userId;
    for (const [pId, uId] of Object.entries(initialSync.playerUserIds ?? {})) {
      if (liveUserId && uId === liveUserId) return pId;
    }
    return null;
  });
  // Mirror of myPlayerId for the socket handlers, which are registered once
  // (their effect deps do not include the seat). Reading a ref there is what
  // keeps the "is this event about me?" check honest from the first frame,
  // before a re-render happens to refresh the closure.
  const myPlayerIdRef = useRef<string | null>(myPlayerId);
  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number>(() => {
    if (!initialSync) return 0;
    const seat =
      initialSync.you ??
      (() => {
        const liveUserId = getIdentity()?.userId;
        for (const [pId, uId] of Object.entries(initialSync.playerUserIds ?? {})) {
          if (liveUserId && uId === liveUserId) return pId;
        }
        return null;
      })();
    if (!seat) return 0;
    const idx = initialSync.state.players.findIndex((p) => p.id === seat);
    return idx >= 0 ? idx : 0;
  });
  /**
   * Seat id ('p1', 'p2', ...) -> userId, straight from the server. A
   * PlayerState only carries a displayName, so this is the ONE mapping that
   * turns a board seat into a real account: without it the opponent's name on
   * the match board and in the result modal cannot reach their profile.
   */
  const [playerUserIds, setPlayerUserIds] = useState<Record<string, string>>(
    () => initialSync?.playerUserIds ?? {}
  );
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  /**
 * A seat that is inside a reconnect grace window.
 *
 * `graceEndsAt` is the SERVER's deadline — the countdown is derived from it
 * (see the effect below) rather than decremented locally, so what the player
 * sees always matches what the server will actually honour.
 */
interface OpponentGrace {
  userId: string;
  playerId: string | null;
  /** Server timestamp at which the window closes. */
  graceEndsAt: number;
  /** Remaining seconds, derived from graceEndsAt. Render only. */
  seconds: number;
}

/**
 * A seat that is CONNECTED but has not moved within the inactivity limit.
 *
 * Deliberately a separate state from OpponentGrace: same forfeit outcome,
 * completely different cause (a backgrounded tab, not a dead socket) and a
 * different indicator. Merging them would tell a player their opponent is
 * "disconnected" when their opponent is sitting right there on their phone.
 */
interface AfkWarning {
  playerId: string | null;
  /** Seconds the server will wait before forfeiting the seat. */
  secondsRemaining: number;
}

const [opponentGrace, setOpponentGrace] = useState<OpponentGrace | null>(null);
  const [afkWarning, setAfkWarning] = useState<AfkWarning | null>(null);
  // Mirror for the socket handlers (registered once): "is a seat currently
  // inside a grace window?" decides whether an AFK notice is meaningful.
  const opponentGraceRef = useRef<OpponentGrace | null>(opponentGrace);
  useEffect(() => {
    opponentGraceRef.current = opponentGrace;
  }, [opponentGrace]);
  const [rematchOffered, setRematchOffered] = useState<boolean>(false);
  const [rematchOfferNonce, setRematchOfferNonce] = useState<number>(0);
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const rematchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameEndedResult, setGameEndedResult] = useState<GameEndedDto | null>(null);
  // Seeded by the join gate: the first sync already happened pre-navigation,
  // so there is nothing to wait for. The mount join below still runs to
  // attach the room channel for live events.
  const [isSyncing, setIsSyncing] = useState<boolean>(() => !initialSync);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [lastFinished, setLastFinished] = useState<{ gameId: string; playerId: string; userId: string; place: number } | null>(null);
  const joinAttemptsRef = useRef<number>(0);

  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResyncRef = useRef(0);
  const actionCounterRef = useRef(0);
  /**
   * Unconfirmed tail per game: entries leave ONLY on server confirmation
   * (accepted echo carrying our clientActionId) or when a sync proves them
   * obsolete — never merely because the UI painted optimistically.
   */
  const pendingRef = useRef<Record<string, PendingAction[]>>({});
  /**
   * The unconfirmed tail as STATE, not just a ref.
   *
   * The optimistic board is derived from this during render, so it has to be
   * a value the renderer can read — a ref would either need reading during
   * render (impure) or a second state copy to mirror it. `setPending` is the
   * single writer and keeps both in step.
   */
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  /** Single writer: ref (socket handlers) and state (renderer) never diverge. */
  const setPending = useCallback(
    (list: PendingAction[]) => {
      pendingRef.current = { ...pendingRef.current, [gameId]: list };
      setPendingActions(list);
    },
    [gameId]
  );
  const pendingFor = useCallback(() => pendingRef.current[gameId] ?? [], [gameId]);
  const pendingCount = pendingActions.length;
  // Deadline anchor for the DISPLAY ticker: server ms remaining + the
  // local timestamp we received it at. The ticker below only derives
  // from this — the server deadline stays the single source of truth.
  // Seeded after mount (not in the initializer — the render must stay pure).
  // Until it lands, the display ticker simply doesn't advance; the seeded
  // second-clocks above are already correct, and the mount join's live sync
  // replaces all of this within milliseconds anyway.
  const clockAnchorRef = useRef<{ remainingMs: Record<string, number>; at: number } | null>(null);
  useEffect(() => {
    if (initialSync && !clockAnchorRef.current) {
      clockAnchorRef.current = {
        remainingMs: { ...initialSync.clock.remainingMs },
        at: Date.now(),
      };
    }
    // Runs once per mount: the seed belongs to the mounted game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /**
 * Latest authoritative clock map, for handoff snapshots. The display
 * `clocks` state holds derived seconds; gates need the raw ms deadlines.
 */
const getSyncClockMs = useCallback((): Record<string, number> => {
    return { ...(clockAnchorRef.current?.remainingMs ?? {}) };
  }, []);
  const everConnectedRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

  /**
   * Offset between the server's clock and ours, in ms (server minus local).
   *
   * Measured from the `game:ping` round trip: with a symmetric path, the
   * server's stamp sits at the midpoint of the exchange. Every authoritative
   * timestamp is then interpreted through this instead of being treated as
   * local time — which is what made a phone whose clock was minutes off show
   * a frozen or instantly-expired game clock.
   */
  const serverSkewMsRef = useRef<number>(0);
  const roundTripMsRef = useRef<number>(0);

  /** Server time, as best we can tell, right now. */
  const serverNow = useCallback((): number => {
    return Date.now() + serverSkewMsRef.current;
  }, []);

  /**
   * Times one `game:ping` round trip and updates the skew + RTT estimates.
   *
   * Two things come out of a single exchange:
   *  - the RTT, which the SERVER uses to refund this player's own network cost
   *    from their clock (see recordLatency);
   *  - the skew between the two clocks, which is what lets the client render
   *    `serverTimestamp` correctly instead of assuming its own clock is right.
   *
   * Only the client can time when a reply actually LANDED, which is why the
   * measurement is made here and reported, rather than the server timing its
   * own side of the exchange.
   */
  const probeLatency = useCallback(() => {
    const socket = socketManager.getSocket();
    if (!socket.connected) return;
    const clientSentAt = Date.now();
    socket.emit('game:ping', { gameId, clientSentAt }, (res) => {
      const receivedAt = Date.now();
      const rtt = receivedAt - clientSentAt;
      // Implausible samples are dropped rather than believed: a phone waking
      // from sleep can produce a "round trip" of minutes.
      if (rtt < 0 || rtt > 5000) return;
      roundTripMsRef.current = roundTripMsRef.current === 0 ? rtt : roundTripMsRef.current + (rtt - roundTripMsRef.current) * 0.3;
      // The server stamped its reply at the midpoint of the exchange on a
      // symmetric path, so that midpoint minus the server stamp is our skew.
      const serverMidpoint = res.serverTimestamp + rtt / 2;
      const sample = serverMidpoint - receivedAt;
      serverSkewMsRef.current =
        serverSkewMsRef.current === 0 ? sample : serverSkewMsRef.current + (sample - serverSkewMsRef.current) * 0.3;
    });
  }, [gameId]);

  /**
   * Re-anchors the display ticker from an authoritative clock packet.
   *
   * `serverTimestamp` is when the SERVER sampled the clocks; the packet took
   * roughly half a round trip to reach us, so anchoring at `Date.now()` would
   * hide that delay and show the mover slightly more time than they have.
   * The anchor is placed at the local instant corresponding to the server's
   * sample, corrected by skew and by the measured one-way delay.
   */
  const anchorClock = useCallback(
    (packet: { remainingMs: Record<string, number>; serverTimestamp: number }) => {
      const localReceive = Date.now();
      // One-way delay is half the last measured round trip (capped so a single
      // pathological sample cannot shift the whole clock).
      const oneWay = Math.min(roundTripMsRef.current / 2, 1000);
      const anchorLocalTime = localReceive - oneWay;
      clockAnchorRef.current = {
        remainingMs: { ...packet.remainingMs },
        at: anchorLocalTime,
      };
      const seconds: Record<string, number> = {};
      for (const [playerId, ms] of Object.entries(packet.remainingMs)) {
        seconds[playerId] = Math.ceil(ms / 1000);
      }
      setClocks(seconds);
    },
    []
  );

  // Local second ticker for the ACTIVE clock, derived from the last
  // server deadline (never decremented blindly — a stalled event loop
  // cannot grant phantom time, it only delays the display refresh).
  useEffect(() => {
    if (!gameState || gameState.status !== 'IN_PROGRESS') return;

    const timer = setInterval(() => {
      const activeState = gameStateRef.current;
      const anchor = clockAnchorRef.current;
      if (!activeState || activeState.status !== 'IN_PROGRESS' || !anchor) return;

      const activePlayer = activeState.players[activeState.currentPlayerIndex];
      if (!activePlayer) return;
      const base = anchor.remainingMs[activePlayer.id];
      if (base === undefined) return;
      const shown = Math.max(0, Math.ceil((base - (Date.now() - anchor.at)) / 1000));
      setClocks((prev) => (prev[activePlayer.id] === shown ? prev : { ...prev, [activePlayer.id]: shown }));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.status]);

  /**
   * Keeps the latency/skew estimate fresh while a match runs.
   *
   * The estimate is what makes the clock fair on a bad connection, so it has
   * to track the connection rather than be measured once at join — a phone
   * that moves from wifi to cellular mid-game would otherwise keep the old
   * number. Cheap: one small round trip every few seconds, and none at all
   * while the game is not in progress.
   */
  useEffect(() => {
    if (gameState?.status !== 'IN_PROGRESS') return undefined;
    probeLatency();
    const timer = setInterval(probeLatency, LATENCY_PROBE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [gameState?.status, probeLatency]);

  // Grace countdown: derived from the SERVER's deadline, not a local copy of
  // "45 seconds". The old version decremented a local counter, so a phone
  // that slept or got throttled for 30s would still show 15s remaining while
  // the server had already forfeited — or showed the window as expired while
  // the server was still willing to wait.
  useEffect(() => {
    if (!opponentGrace) {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      return;
    }

    const tick = () => {
      setOpponentGrace((prev) => {
        if (!prev) return null;
        const left = Math.max(0, Math.ceil((prev.graceEndsAt - serverNow()) / 1000));
        if (left <= 0) {
          if (graceTimerRef.current) clearInterval(graceTimerRef.current);
          return null;
        }
        return { ...prev, seconds: left };
      });
    };
    tick();
    graceTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
    // Re-arms per disconnected seat; `serverNow` is a stable callback.
  }, [opponentGrace?.userId, opponentGrace?.graceEndsAt, serverNow]);

  const joinGame = useCallback(() => {
    const socket = socketManager.getSocket();
    setIsSyncing(true);
    setJoinError(null);
    joinAttemptsRef.current = 0;
    socket.emit('game:join', {
      gameId,
      lastSequence: gameStateRef.current?.history.length ?? 0,
      pendingActions: (pendingRef.current[gameId] ?? []).map((p) => ({
        clientActionId: p.clientActionId,
        action: p.action,
      })),
    });
  }, [gameId]);

  /**
   * Re-emit game:join if the server has not answered. Without this a dropped
   * or coalesced emit leaves isSyncing true forever: the overlay in GameScreen
   * is gated purely on that flag, so the player sits on "Connecting to match"
   * with no way out except a Cancel button that does not release their seat.
   */
  useEffect(() => {
    if (!isSyncing) return undefined;
    const timer = setInterval(() => {
      joinAttemptsRef.current += 1;
      if (joinAttemptsRef.current > JOIN_ATTEMPT_LIMIT) {
        setJoinError(
          'Could not reach the match. It may have been abandoned — go back and search again.'
        );
        setIsSyncing(false);
        return;
      }
      // Same payload as joinGame, INCLUDING the unconfirmed tail. The retry
      // used to drop it, so a join that landed after a reconnect asked the
      // server for a resync while our in-flight moves were never mentioned —
      // the board came back without them.
      socketManager.getSocket().emit('game:join', {
        gameId,
        lastSequence: gameStateRef.current?.history.length ?? 0,
        pendingActions: pendingFor().map((p) => ({
          clientActionId: p.clientActionId,
          action: p.action,
        })),
      });
    }, JOIN_RETRY_MS);
    return () => clearInterval(timer);
  // `pendingFor` reads a ref keyed by gameId; gameId is already a
    // dependency, so the closure is never stale for this subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, gameId]);

  // Rejoin + resync automatically after a transport reconnect (e.g. fresh
  // token). Skipped on first connect — mount already joins.
  useEffect(() => {
    if (connStatus === 'connected') {
      if (everConnectedRef.current) joinGame();
      everConnectedRef.current = true;
    }
  }, [connStatus, joinGame]);

  /**
   * Switching games without remounting (rematch): the subscription effect
   * rejoins on the new gameId and the previous board stays visible as the
   * waiting visual — but terminal states from the old game must not leak
   * across. An old joinError would otherwise pin an error banner over a game
   * that hasn't even been joined yet.
   */
  const prevGameIdRef = useRef(gameId);
  useEffect(() => {
    if (prevGameIdRef.current === gameId) return;
    prevGameIdRef.current = gameId;
    joinAttemptsRef.current = 0;
    setJoinError(null);
    setGameEndedResult(null);
    setRematchOffered(false);
    setRematchGameId(null);
setOpponentGrace(null);
    setAfkWarning(null);
    setLastFinished(null);
  }, [gameId]);

  /**
   * Terminal server rejection.
   *
   * Also ROLLS BACK the pending tail. Leaving a rejected move in the queue
   * meant the optimistic board kept showing it — and the optimistic state
   * replays that queue on every render, so the phantom move persisted over
   * the real board until the next full sync. Rejection means the server never
   * took it; confirmed state is the truth again.
   *
   * STALE_SEQUENCE is the exception: it is our own bookkeeping being wrong,
   * not the move being illegal, so the tail is kept and resubmitted with the
   * resync.
   */
  const handleError = useCallback(
    (error: GameError) => {
      console.warn('Game error from server:', error);
      if (error.code === 'STALE_SEQUENCE') {
        // Our view of the sequence drifted: pull full truth. The tail rides
        // along with the join so the moves are not lost.
        joinGame();
        return;
      }
      setPending([]);
      // isSyncing MUST be cleared here: the GameScreen overlay renders purely
      // off that flag, so leaving it true pins the player on "Connecting to
      // match" indefinitely with no message, while their clock runs down and
      // the game is eventually forfeited in their name.
      const messages: Record<string, string> = {
        UNAUTHENTICATED: 'Your session expired. Reconnect and try again.',
        NOT_SEATED:
          'This match belongs to a different account. Go back and find a new opponent.',
        GAME_NOT_IN_PROGRESS: 'That match is no longer available. Go back and search again.',
        ALREADY_IN_GAME: 'You are already in a match. Finish it first.',
        // A rejected ACTION, not a failed join. These used to fall through to
        // the generic "could not join" line, which told a player whose move
        // was illegal that their match was unreachable.
        ILLEGAL_MOVE: 'That move was not legal here.',
        NOT_YOUR_TURN: 'Wait for your turn.',
        UNKNOWN_ACTION: 'That move could not be read.',
        WALL_CROSSES_EXISTING: 'A wall cannot cross another wall.',
        WALL_ALREADY_OCCUPIED: 'That wall slot is taken.',
        NO_WALLS_REMAINING: 'No walls left to place.',
      };
      const message = messages[error.code] ?? 'Could not join that match. Go back and try again.';
      setJoinError(message);
      setIsSyncing(false);
      if (onError) onError(error);
    },
    [joinGame, setPending, onError]
  );

  /**
   * Reconciles one server-accepted action: drops the matching pending entry
   * and folds the move into confirmed state.
   *
   * Idempotent on purpose — it is called from BOTH the room echo and the
   * direct ack, and either can arrive first. Re-applying a sequence that is
   * already in history is a no-op, so the pair is safe in any order.
   */
  const handleActionAccepted = useCallback(
    (recorded: RecordedAction) => {
      const echoedId = (recorded as { clientActionId?: string }).clientActionId;
      if (echoedId) {
        const list = pendingFor();
        if (list.some((p) => p.clientActionId === echoedId)) {
          setPending(list.filter((p) => p.clientActionId !== echoedId));
        }
      }
      setGameState((prev) => {
        if (!prev) return prev;
        // Already folded in (the other delivery path won the race).
        const existing = prev.history.find((h) => h.sequence === recorded.sequence);
        if (existing) {
          if (sameAction(existing.action, recorded.action)) return prev;
          // Same sequence, different action: we diverged — pull full truth
          // (throttled; updaters must stay side-effect-light).
          const now = Date.now();
          if (now - lastResyncRef.current > 3000) {
            lastResyncRef.current = now;
            joinGame();
          }
          return prev;
        }
        const result = applyAction(prev, recorded.action, {
          timestamp: recorded.timestamp,
          clockRemainingMs: recorded.clockRemainingMs,
          // The recorded player is always the true actor — including
          // off-turn resigns/forfeits, which a bare current-player
          // assumption would misattribute (and corrupt local state).
          actorId: recorded.playerId,
        });
        return result.success ? result.state : prev;
      });
    },
    [pendingFor, setPending, joinGame]
  );

  useEffect(() => {
    const socket = socketManager.getSocket();
    const unsubStatus = socketManager.subscribeStatus(setConnStatus);

    joinGame();

    const handleSync = (sync: GameSyncDto) => {
      setIsSyncing(false);
      setGameState(sync.state);

      // The seat -> account map rides along with every sync. Keep it: the
      // opponent's chips need a userId to open a profile, and this is the
      // only place it exists (a board seat id is not a user id).
      if (sync.playerUserIds) setPlayerUserIds(sync.playerUserIds);

      // Prune the pending tail against authoritative truth: anything at or
      // below the server length is either confirmed or dead — the sync
      // itself is the rollback. What stays will be resubmitted next join.
      const serverLen = sync.state.history.length;
      const kept = pendingFor().filter((p) => p.expectedSequence > serverLen);
      if (kept.length !== pendingFor().length) {
        setPending(kept);
      }

      // Anchor from the SERVER's sample, corrected for clock skew and the
      // measured one-way delay. Treating `Date.now()` as the server's clock is
      // what made a phone with a skewed clock show a frozen game.
      anchorClock(sync.clock);
      // The sync's own latency sample is worth taking: it costs nothing here
      // and keeps the skew estimate fresh across a reconnect.
      probeLatency();

      // Resolve myPlayerId & seat.
      //
      // `sync.you` is the seat the SERVER resolved from our verified token.
      // It is authoritative and always correct. The id comparison below is
      // only a fallback for a server that does not send it, and it reads the
      // live identity rather than a value frozen at mount.
      const serverSeat = sync.you ?? null;
      if (serverSeat) {
        setMyPlayerId(serverSeat);
        const idx = sync.state.players.findIndex((p) => p.id === serverSeat);
        if (idx >= 0) setMyPlayerIndex(idx);
      } else if (sync.playerUserIds) {
        const liveUserId = getIdentity()?.userId;
        for (const [pId, uId] of Object.entries(sync.playerUserIds)) {
          if (liveUserId && uId === liveUserId) {
            setMyPlayerId(pId);
            const idx = sync.state.players.findIndex((p) => p.id === pId);
            if (idx >= 0) setMyPlayerIndex(idx);
            break;
          }
        }
      } else {
        // Legacy fallback: match by displayName.
        const idx = sync.state.players.findIndex(
          (p) => p.displayName === getIdentity()?.displayName
        );
        if (idx >= 0) {
          setMyPlayerId(sync.state.players[idx].id);
          setMyPlayerIndex(idx);
        }
      }
    };

    const handleClock = (clock: ClockStateDto) => {
      anchorClock(clock);
    };

    const handleEnded = (ended: GameEndedDto) => {
      setGameEndedResult(ended);
      setGameState((prev) => {
        if (!prev) return prev;
        // Carry the authoritative final order into local state (places +
        // finished flags) so the result UI never invents placements.
        const placeById = new Map(
          (ended.placements ?? []).map((p) => [p.playerId, p.place])
        );
        return {
          ...prev,
          status: 'COMPLETED',
          winnerId: ended.winnerId,
          players: prev.players.map((p) => {
            const place = placeById.get(p.id);
            if (place === undefined) return p;
            return { ...p, status: 'FINISHED' as const, place };
          }),
        };
      });
      if (onGameEnded) onGameEnded(ended);
    };

    const handleOpponentDisconnected = (payload: {
      userId: string;
      playerId?: string;
      gracePeriodSeconds: number;
      graceEndsAt: number;
    }) => {
      // This event is about a SEAT, not "the opponent". The server now
      // excludes the leaver's own sockets, but the client must not depend on
      // that: on a 3P/4P table any other seat dropping matters, and your own
      // seat must never raise a banner telling you the opponent left — or
      // arm a grace countdown against yourself while you are standing there.
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      // Absence and idling are mutually exclusive for one seat: a player who
      // is away cannot also be idle, and showing both indicators at once would
      // be a lie about which one the server is actually counting down.
      setAfkWarning(null);
      setOpponentGrace({
        userId: payload.userId,
        playerId: payload.playerId ?? null,
        graceEndsAt: payload.graceEndsAt,
        seconds: Math.max(0, Math.ceil((payload.graceEndsAt - serverNow()) / 1000)),
      });
    };

    const handleOpponentReconnected = (payload: { userId?: string; playerId?: string } = {}) => {
      // Symmetric: a reconnect event about your own seat must not cancel a
      // real opponent's countdown.
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      setOpponentGrace(null);
      // Coming back clears the absence; whether they are idle is the server's
      // call from here, so drop any stale AFK warning too rather than
      // leaving a countdown on screen for a player who just reconnected.
      setAfkWarning(null);
    };

    /**
     * Inactivity notice for the seat on turn. Fires once, shortly before the
     * server's limit, so the player is told rather than simply losing.
     */
    const handleAfkWarning = (payload: { playerId?: string; secondsRemaining: number }) => {
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      // An absent seat is not an idle one.
      if (opponentGraceRef.current) return;
      setAfkWarning({
        playerId: payload.playerId ?? null,
        secondsRemaining: payload.secondsRemaining,
      });
    };

    const handleAfkCleared = (payload: { playerId?: string } = {}) => {
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      setAfkWarning(null);
    };

    const handleRematchOffered = () => {
      // Re-sending the same offer must re-trigger the receiver's toast, so
      // bump a nonce even when rematchOffered is already true.
      setRematchOffered(true);
      setRematchOfferNonce((n) => n + 1);
      if (rematchTimerRef.current) clearTimeout(rematchTimerRef.current);
      rematchTimerRef.current = setTimeout(() => setRematchOffered(false), 30000);
    };

    const handleRematchMatched = (payload: { gameId: string }) => {
      // Both players accepted a rematch: a brand-new game is starting.
      setRematchOffered(false);
      setRematchGameId(payload.gameId);
    };

    const handleFinished = (finished: { gameId: string; playerId: string; userId: string; place: number }) => {
      setLastFinished(finished);
    };

  socket.on('game:sync', handleSync);
    socket.on('game:actionAccepted', handleActionAccepted);
    socket.on('game:clock', handleClock);
    socket.on('game:ended', handleEnded);
    socket.on('game:opponentDisconnected', handleOpponentDisconnected);
    socket.on('game:opponentReconnected', handleOpponentReconnected);
    socket.on('game:afkWarning', handleAfkWarning);
    socket.on('game:afkCleared', handleAfkCleared);
    socket.on('game:rematchOffered', handleRematchOffered);
    socket.on('matchmaking:matched', handleRematchMatched);
    socket.on('game:playerFinished', handleFinished);
    socket.on('game:error', handleError);

    return () => {
      unsubStatus();
      socket.off('game:sync', handleSync);      socket.off('game:actionAccepted', handleActionAccepted);
      socket.off('game:clock', handleClock);
      socket.off('game:ended', handleEnded);
      socket.off('game:opponentDisconnected', handleOpponentDisconnected);
      socket.off('game:opponentReconnected', handleOpponentReconnected);
      socket.off('game:afkWarning', handleAfkWarning);
      socket.off('game:afkCleared', handleAfkCleared);
      socket.off('game:rematchOffered', handleRematchOffered);
      socket.off('matchmaking:matched', handleRematchMatched);
      socket.off('game:playerFinished', handleFinished);
      socket.off('game:error', handleError);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      if (rematchTimerRef.current) clearTimeout(rematchTimerRef.current);
    };
    // Deliberately NOT depending on the handlers: `onError` is typically an
    // inline arrow from GameScreen, so listing it would re-register every
    // socket listener on every render of the screen. The handlers read only
    // refs and setters that are stable for the life of the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, identity?.userId, identity?.displayName, joinGame, onGameEnded]);

  /**
   * Derived display state: the confirmed board with our own unconfirmed
   * actions replayed on top, so a tap moves the orb immediately instead of
   * waiting for the server round-trip.
   *
   * Provisional rules — this state is a PREDICTION, never a fact:
   *  - a predicted win does NOT flip the game to COMPLETED, and the mover is
   *    not marked FINISHED. Claiming a goal before the server agrees is how a
   *    rejected move used to look like a finished game;
   *  - nothing here is persisted: if the server rejects the move, the pending
   *    entry disappears and this derivation reverts to confirmed truth.
   */
  const optimisticState = useMemo<GameState | null>(() => {
    if (!gameState || pendingActions.length === 0) return gameState;
    let next = gameState;
    for (const p of pendingActions) {
      const mover = next.players[next.currentPlayerIndex];
      if (!mover) break;
      const res = applyAction(next, p.action, {
        timestamp: p.clientTimestamp,
        clockRemainingMs: 0,
        // Our own pending action always belongs to the turn we are shown.
        actorId: mover.id,
      });
      if (!res.success) break;
      next = res.state;
    }
    if (next === gameState) return gameState;
    if (next.status !== 'COMPLETED') return next;
    // Predicted finish: keep the board (the orb is where we sent it) but
    // restore the confirmed outcome so nothing announces a win unverified.
    return {
      ...next,
      status: gameState.status,
      winnerId: gameState.winnerId,
      players: next.players.map((p) => {
        const confirmed = gameState.players.find((c) => c.id === p.id);
        return {
          ...p,
          status: confirmed?.status ?? p.status,
          place: confirmed?.place ?? null,
        };
      }),
    };
  }, [gameState, pendingActions]);

  const sendAction = useCallback(
    (action: GameAction) => {
      const socket = socketManager.getSocket();
      const list = pendingFor();
      // One action in flight. A second tap while the first is unconfirmed
      // would send a move for a turn the server has not handed over yet:
      // STALE_SEQUENCE, then a full resync, then a board that jumps back.
      // Dropping it is honest — the player sees nothing move and simply
      // taps again once their orb is theirs to move.
      if (list.length > 0) return false;
      // Belt-and-braces: input locking above makes this unreachable, but if a
      // future change ever lets a second action through, refuse rather than
      // truncate — the oldest pending entry would be silently dropped on
      // reconnect and the player would never learn their move was lost.
      if (list.length >= MAX_PENDING) {
        console.warn('[online] refusing action: unconfirmed tail at cap', list.length);
        return false;
      }
      // Idempotency key + expected sequence: mobile retries replay the
      // original server result instead of double-applying. The entry stays
      // queued until the accepted echo (or a sync) proves it settled.
      actionCounterRef.current += 1;
      const historyLen = gameStateRef.current?.history.length ?? 0;
      const clientTimestamp = Date.now();
      const clientActionId = `${identity?.userId ?? 'anon'}-${clientTimestamp}-${actionCounterRef.current}`;
      // The server's next sequence is its CONFIRMED history length plus
      // everything we already have in flight — not the confirmed length
      // alone, which is what produced STALE_SEQUENCE whenever an echo was
      // slow to arrive. With one action in flight this is normally +1, but
      // the pending count is added explicitly so the invariant survives the
      // day the lock is relaxed.
      const expectedSequence = historyLen + list.length + 1;
      setPending([...list, { clientActionId, expectedSequence, action, clientTimestamp }]);
      socket.emit(
        'game:action',
        {
          gameId,
          action,
          clientTimestamp,
          clientActionId,
          expectedSequence,
        },
        // Direct answer from the server for THIS socket: the move is applied
        // locally the moment it lands, without waiting for the room
        // broadcast that also has to reach the other seats. Idempotent, so
        // arriving after the echo (or twice) is harmless.
        (res) => {
          if (res?.ok) {
            handleActionAccepted(res.recorded);
          } else if (res?.code) {
            handleError({ code: res.code, message: res.message });
          }
        }
      );
      return true;
    },
    [gameId, identity?.userId, pendingFor, setPending, handleActionAccepted, handleError]
  );

  const resign = useCallback(() => {
    const socket = socketManager.getSocket();
    socket.emit('game:resign', { gameId });
  }, [gameId]);

  const offerRematch = useCallback(() => {
    const socket = socketManager.getSocket();
    setRematchOffered(false);
    if (rematchTimerRef.current) clearTimeout(rematchTimerRef.current);
    socket.emit('game:rematch', { gameId });
  }, [gameId]);

return {
    gameState,
    /** Confirmed board + our in-flight moves, for rendering. See above. */
    optimisticState,
    /** True while a move of ours is unconfirmed: input locks until it settles. */
    inputLocked: pendingCount > 0,
    /** Seat inside a reconnect grace window (drives the Disconnected card). */
    opponentGrace,
    /** Seat on turn with no move yet (drives the AFK card). Distinct state. */
    afkWarning,
    /** Server-side view of now, in server time. For deadlines. */
    serverNow,
    clocks,
    myPlayerId,
    myPlayerIndex,
    playerUserIds,
connStatus,
    rematchOffered,
    rematchOfferNonce,
    rematchGameId,
    gameEndedResult,
    isSyncing,
    joinError,
    pendingCount,
    lastFinished,
    sendAction,
    resign,
    offerRematch,
    resync: joinGame,
    getSyncClockMs,
  };
}
