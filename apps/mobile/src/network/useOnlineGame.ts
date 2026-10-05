import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { GameAction, GameError, GameState, RecordedAction, applyAction } from '@duoorb/game-core';
import { ClockStateDto, GameEndedDto, GameSyncDto } from '@duoorb/protocol';
import { socketManager, ConnectionStatus } from './socket';
import { getIdentity, useIdentity } from './auth';
import { refreshSessionOnce } from './apiClient';

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
/** How often a seat-less but synced client re-asks for its seat (the hook's
 * own pump — see below). Same order as the join retry: slow enough to stay
 * inside the emit cooldown's spirit, fast enough to catch a hydrating
 * identity within seconds. */
const SEAT_MISS_RETRY_MS = 5000;
/** After this many unanswered retries, surface an error instead of spinning. */
const JOIN_ATTEMPT_LIMIT = 8;
/**
 * Minimum gap between `game:join` wire emits. A reconnect fires several
 * join sources within milliseconds (queue flush, reconnect effect, retry
 * tick) — without this each spawns its own server-side replay + sync +
 * opponent fan-out. Below the retry interval, so the backstop still fires.
 */
const JOIN_EMIT_COOLDOWN_MS = 2000;

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
 * An event with no `playerId` is treated as NOT ours: an unnecessary card
 * indicator is a smaller failure than hiding a real opponent's absence.
 */
export function isOwnSeatEvent(
  payload: { userId?: string; playerId?: string | null },
  myPlayerId: string | null
): boolean {
  if (!myPlayerId) return false;
  return !!payload.playerId && payload.playerId === myPlayerId;
}

/**
 * Which severity a `game:error` gets. Context decides, not the code: an
 * error that lands while a join is still unanswered rejected the JOIN
 * (terminal — even when a stale board from a previous game is on screen),
 * while one that lands on a settled channel rejected a single ACTION
 * (transient). Pure so the rule is unit-testable; the hook owns the inputs.
 */
export function classifyGameError(input: { joinOutstanding: boolean; hasBoard: boolean }): 'join' | 'action' {
  if (input.joinOutstanding || !input.hasBoard) return 'join';
  return 'action';
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
  /**
   * UserIds holding effective premium at game creation (P5.2 seat/GameOver
   * badges). Frozen for the match — a present list (even empty) replaces the
   * state; an absent list (old server) leaves prior state alone.
   */
  const [premiumUserIds, setPremiumUserIds] = useState<string[]>(
    () => initialSync?.premiumUserIds ?? []
  );
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  // OS link verdict, for honest copy ("You're offline" vs "Reconnecting…").
  const [linkDown, setLinkDown] = useState<boolean>(() => socketManager.isLinkDown());
  useEffect(() => socketManager.subscribeLink(setLinkDown), []);
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
 *
 * `afkEndsAt` is the SERVER's forfeit deadline — the card countdown is
 * derived from it (see the effect below), exactly like the grace countdown,
 * so it ticks down in real time instead of freezing at the value the
 * one-shot warning carried.
 */
interface AfkWarning {
  playerId: string | null;
  /** Server timestamp at which the seat forfeits for inactivity. */
  afkEndsAt: number;
  /** Remaining seconds, derived from afkEndsAt. Render only. */
  secondsRemaining: number;
}

/**
 * Seats inside a reconnect grace window, keyed by userId. A record, not a
 * single slot: on a 3P/4P table two seats can be away at once, and either
 * reconnect must clear only its own countdown — never the other seat's.
 */
const [opponentGrace, setOpponentGrace] = useState<Record<string, OpponentGrace>>({});
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
  /** Local instant of the last RTT sample: one-way correction expires with it. */
  const roundTripAtRef = useRef<number>(0);
  const [afkWarning, setAfkWarning] = useState<AfkWarning | null>(() => {
    const afk = initialSync?.afk;
    if (!afk) return null;
    // Date.now(), not serverNow(): skew starts at 0 on first render, so this
    // IS server time at seed; the 1s ticker self-corrects from the first
    // probe on. Reading the skew ref here would only trip render purity.
    return {
      playerId: afk.playerId,
      afkEndsAt: afk.afkEndsAt,
      secondsRemaining: Math.max(0, Math.ceil((afk.afkEndsAt - Date.now()) / 1000)),
    };
  });
  // Mirror for the socket handlers (registered once): "is any seat
  // currently inside a grace window?" decides whether an AFK notice is
  // meaningful — absence owns the whole table while it lasts.
  const opponentGraceRef = useRef<Record<string, OpponentGrace>>(opponentGrace);
  useEffect(() => {
    opponentGraceRef.current = opponentGrace;
  }, [opponentGrace]);
  const [rematchOffered, setRematchOffered] = useState<boolean>(false);
  const [rematchOfferNonce, setRematchOfferNonce] = useState<number>(0);
  const [rematchDeclinedNonce, setRematchDeclinedNonce] = useState<number>(0);
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const rematchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameEndedResult, setGameEndedResult] = useState<GameEndedDto | null>(null);
  // Seeded by the join gate: the first sync already happened pre-navigation,
  // so there is nothing to wait for. The mount join below still runs to
  // attach the room channel for live events.
  const [isSyncing, setIsSyncing] = useState<boolean>(() => !initialSync);
  const [joinError, setJoinError] = useState<string | null>(null);
  /**
   * A rejected ACTION on a live board (illegal move, not your turn):
   * transient, surfaced as a sound by the screen, never a joinError — that
   * path is terminal ("tap to leave") and must not fire for a move the
   * server simply refused.
   */
  const [actionError, setActionError] = useState<{ message: string; nonce: number } | null>(null);
  const actionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * A queued move the transport discarded (cap overflow / TTL expiry) AFTER
   * the board showed it optimistically. Not illegal — just never sent — so
   * it rolls the tail back and rides the toast bus without the illegal-move
   * sound. The screen announces it; the hook only records it.
   */
  const [dropNotice, setDropNotice] = useState<{ message: string; nonce: number } | null>(null);
  const [lastFinished, setLastFinished] = useState<{ gameId: string; playerId: string; userId: string; place: number } | null>(null);
  const joinAttemptsRef = useRef<number>(0);
  /** Last `game:join` wire emit — collapses reconnect bursts into one join. */
  const joinLastEmitRef = useRef<number>(0);
  /**
   * True from the moment a `game:join` goes out until its sync lands. This
   * is what tells a JOIN rejection apart from an ACTION rejection: the stale
   * board of a previous game must not downgrade a terminal join failure
   * into a transient blip (see classifyGameError).
   */
  const joinOutstandingRef = useRef(false);

  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const afkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      roundTripAtRef.current = receivedAt;
      // The server stamped its reply at the midpoint of the exchange on a
      // symmetric path, so that midpoint minus the server stamp is our skew.
      const serverMidpoint = res.serverTimestamp + rtt / 2;
      const sample = serverMidpoint - receivedAt;
      serverSkewMsRef.current =
        serverSkewMsRef.current === 0 ? sample : serverSkewMsRef.current + (sample - serverSkewMsRef.current) * 0.3;
      // NOTE: a skew correction moves serverNow() (grace/AFK countdowns)
      // immediately but deliberately NOT the clock anchor: the anchor is a
      // LOCAL receive instant, already correct independent of skew.
      // Re-basing it on skew jumps would introduce error, not remove it.
    });
  }, [gameId]);

  /**
   * Re-anchors the display ticker from an authoritative clock packet.
   *
   * `serverTimestamp` is when the SERVER sampled the clocks; the packet took
   * roughly half a round trip to reach us, so anchoring at `Date.now()` would
   * hide that delay and show the mover slightly more time than they have.
   * The anchor is placed at the local instant corresponding to the server's
   * sample, corrected by the measured one-way delay.
   *
   * The ONLY constructor for anchors (mount seed, syncs, ticks): one place
   * builds them, so the one-way correction can never be forgotten on one
   * path. A stale RTT sample (older than 30s, e.g. post-sleep) corrects by
   * zero and triggers a fresh probe instead of anchoring on ancient data.
   */
  const anchorClock = useCallback(
    (packet: { remainingMs: Record<string, number>; serverTimestamp: number }) => {
      const localReceive = Date.now();
      // One-way delay is half the last measured round trip (capped so a single
      // pathological sample cannot shift the whole clock).
      const rttAge = localReceive - roundTripAtRef.current;
      const oneWay =
        roundTripAtRef.current === 0 || rttAge > 30_000
          ? 0
          : Math.min(roundTripMsRef.current / 2, 1000);
      if (oneWay === 0 && roundTripAtRef.current !== 0) {
        // Sample too old to trust: re-measure now; this anchor goes out
        // uncorrected and the next tick replaces it.
        probeLatency();
      }
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
    [probeLatency]
  );

  useEffect(() => {
    // Mount seed, through the same anchor constructor as every live packet,
    // so the first frame gets the one-way correction (or its honest absence)
    // like everything after it. Placed after anchorClock: effects run post-
    // render, but the declaration must still precede the use statically.
    if (initialSync && !clockAnchorRef.current) {
      anchorClock(initialSync.clock);
    }
    // Runs once per mount: the seed belongs to the mounted game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Grace countdowns: derived from the SERVER's deadlines, not a local copy
  // of "45 seconds". The old version decremented a local counter, so a phone
  // that slept or got throttled for 30s would still show 15s remaining while
  // the server had already forfeited — or showed the window as expired while
  // the server was still willing to wait.
  const graceVersion = Object.keys(opponentGrace)
    .sort()
    .map((u) => `${u}:${opponentGrace[u].graceEndsAt}`)
    .join(',');
  useEffect(() => {
    if (Object.keys(opponentGrace).length === 0) {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      return;
    }

    const tick = () => {
      setOpponentGrace((prev) => {
        let changed = false;
        const next: Record<string, OpponentGrace> = {};
        for (const [userId, entry] of Object.entries(prev)) {
          const left = Math.max(0, Math.ceil((entry.graceEndsAt - serverNow()) / 1000));
          // Hold the last "0s" frame instead of deleting: the forfeit
          // broadcast owns the outcome now, and in the gap the card must
          // read "about to finalize", never healthy-again. Deletion comes
          // from ended/sync/reconnect — never from the ticker.
          if (left <= 0) {
            next[userId] = entry.seconds !== 0 ? { ...entry, seconds: 0 } : entry;
            changed = changed || entry.seconds !== 0;
            continue;
          }
          changed = changed || left !== entry.seconds;
          next[userId] = left !== entry.seconds ? { ...entry, seconds: left } : entry;
        }
        return changed || Object.keys(next).length !== Object.keys(prev).length ? next : prev;
      });
    };
    tick();
    graceTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
    // Re-arms when the SET of away seats changes; `serverNow` is stable.
    // Manual deps are intentional: the record itself is rewritten every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceVersion, serverNow]);

  // AFK countdown: derived from the SERVER's forfeit deadline, not a local
  // copy of "45 seconds" — same contract as the grace countdown above. A
  // phone that slept keeps showing what the server will actually honour,
  // and the indicator clears itself the moment the deadline passes (the
  // forfeit broadcast lands on the same tick).
  useEffect(() => {
    if (!afkWarning) {
      if (afkTimerRef.current) clearInterval(afkTimerRef.current);
      return;
    }

    const tick = () => {
      setAfkWarning((prev) => {
        if (!prev) return null;
        const left = Math.max(0, Math.ceil((prev.afkEndsAt - serverNow()) / 1000));
        if (left <= 0) {
          // Hold "0s" like the grace ticker: removal comes from the forfeit
          // broadcast, a fresh sync, or an explicit clear — never from here.
          if (afkTimerRef.current) clearInterval(afkTimerRef.current);
          return prev.secondsRemaining !== 0 ? { ...prev, secondsRemaining: 0 } : prev;
        }
        return prev.secondsRemaining !== left ? { ...prev, secondsRemaining: left } : prev;
      });
    };
    tick();
    afkTimerRef.current = setInterval(tick, 1000);

    return () => {
      if (afkTimerRef.current) clearInterval(afkTimerRef.current);
    };
    // Re-arms per warned seat; `serverNow` is a stable callback. The whole
    // `afkWarning` object is deliberately not a dep: it is rewritten every
    // tick, which would tear down and rebuild this interval every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afkWarning?.playerId, afkWarning?.afkEndsAt, serverNow]);

  // Scopes the socket's offline-queue replay to this game: emits queued
  // while down (a join, a move) flush on reconnect, and without this a
  // rematch switch in the same window would deliver the previous game's
  // intents into the new one.
  useEffect(() => {
    socketManager.setScopedGame(gameId);
    return () => socketManager.clearScopedGame(gameId);
  }, [gameId]);

  // Silent queue losses (cap/TTL) roll the optimistic tail back: the entry
  // will never send, but the board is still rendering it. Only this game's
  // entries — each mounted channel filters to its own gameId.
  useEffect(() => {
    return socketManager.subscribeDrops((dropped) => {
      const ids = new Set(
        dropped
          .filter((d) => d.gameId === gameId && d.clientActionId)
          .map((d) => d.clientActionId as string)
      );
      if (ids.size === 0) return;
      setPending(pendingFor().filter((p) => !ids.has(p.clientActionId)));
      setDropNotice({
        message: 'Move not sent — connection was down too long. Tap again.',
        nonce: Date.now(),
      });
    });
  }, [gameId, pendingFor, setPending]);

  /**
   * Emits `game:join` for this game. Mount/manual calls reset the attempt
   * budget (fresh start); rejoin-path calls (transport reconnect, seat miss,
   * foreground return) do NOT — resetting there is what let a flapping
   * connection spin on "Connecting" forever without ever surfacing the
   * after-8 error. `joinOutstanding` is set only when an emit is actually
   * attempted (wire or queue), never on a cooldown early-return.
   */
  const joinGame = useCallback((resetAttempts = true) => {    const socket = socketManager.getSocket();
    setIsSyncing(true);
    setJoinError(null);
    if (resetAttempts) joinAttemptsRef.current = 0;
    // Reconnect bursts (queue flush + this + retry tick) collapse here: one
    // wire join per cooldown window, the retry loop stays the backstop.
    const now = Date.now();
    if (now - joinLastEmitRef.current < JOIN_EMIT_COOLDOWN_MS) return;
    joinLastEmitRef.current = now;
    joinOutstandingRef.current = true;
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
   *
   * Stops on its own for finished games: rejoining a COMPLETED board only
   * produces GAME_NOT_IN_PROGRESS errors over the result modal.
   */
  const gameStatus = gameState?.status;
  // Boolean, not the board object: effects below must not restart on moves.
  const hasBoard = gameState !== null;
  useEffect(() => {
    if (!isSyncing) return undefined;
    if (gameEndedResult || gameStatus === 'COMPLETED') return undefined;
    const timer = setInterval(() => {
      // Part of the same burst collapse as joinGame: a tick inside the
      // cooldown window is not an attempt, it just yields to the join
      // already in flight.
      if (Date.now() - joinLastEmitRef.current < JOIN_EMIT_COOLDOWN_MS) return;
      joinLastEmitRef.current = Date.now();
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
      joinOutstandingRef.current = true;
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
  // gameStatus is a scalar (not the whole board): moves never restart this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing, gameId, gameEndedResult, gameStatus]);

  // Rejoin + resync automatically after a transport reconnect (e.g. fresh
  // token). Skipped on first connect — mount already joins. Rejoin-path: no
  // attempt reset (see joinGame), and never for a finished game.
  useEffect(() => {
    if (connStatus === 'connected') {
      if (everConnectedRef.current && !gameEndedResult && gameStatus !== 'COMPLETED') {
        joinGame(false);
      }
      everConnectedRef.current = true;
    }
  }, [connStatus, joinGame, gameEndedResult, gameStatus]);

  // Seat miss, owned here instead of the screen: sync arrived but no seat
  // resolved (identity hydrating a moment after the first sync). Same single
  // pump — same cooldown, same attempt budget — so a genuinely unseated
  // client surfaces joinError after N instead of interval-joining forever
  // from two places at once. Stops the moment the seat, an error, or the
  // game end lands. Interval-only (no immediate emit): the mount join is
  // already in flight, and an immediate emit here would re-trigger the
  // set-state-in-effect pattern this file otherwise avoids adding to.
  useEffect(() => {
    if (!hasBoard || gameStatus !== 'IN_PROGRESS') return undefined;
    if (myPlayerId || joinError || gameEndedResult) return undefined;
    const timer = setInterval(() => {
      joinGame(false);
    }, SEAT_MISS_RETRY_MS);
    return () => clearInterval(timer);
  }, [gameId, hasBoard, gameStatus, myPlayerId, joinError, gameEndedResult, joinGame]);

  // Foreground rejoin (R2): the OS may freeze JS timers AND the socket with
  // no disconnect ever firing (half-open TCP looks connected), while server
  // grace/AFK keep billing the absence. socket.io's own heartbeat can take
  // its full timeout to notice; an explicit foreground pass — probe, sync
  // identity, reconnect, rejoin — collapses that window to one cooldown.
  // Rejoin-path throughout (no attempt reset): the budget keeps accounting
  // across backgrounding instead of restarting from zero every return.
  useEffect(() => {
    if (typeof AppState?.addEventListener !== 'function') return;
    let lastState = 'active';
    const sub = AppState.addEventListener('change', (next) => {
      const wasAway = lastState !== 'active';
      lastState = next;
      if (next === 'active' && wasAway && !gameEndedResult) {
        probeLatency();
        socketManager.syncWithIdentity();
        socketManager.getSocket();
        joinGame(false);
      }
    });
    return () => sub.remove();
  }, [joinGame, probeLatency, gameEndedResult]);

  /**
   * Switching games without remounting (rematch): the subscription effect
   * rejoins on the new gameId and the previous board stays visible as the
   * waiting visual — but terminal states from the old game must not leak
   * across. An old joinError would otherwise pin an error state over a game
   * that hasn't even been joined yet.
   */
  const prevGameIdRef = useRef(gameId);
  useEffect(() => {
    if (prevGameIdRef.current === gameId) return;
    prevGameIdRef.current = gameId;
    joinAttemptsRef.current = 0;
    joinOutstandingRef.current = false;
    setJoinError(null);
    setActionError(null);
    if (actionErrorTimerRef.current) {
      clearTimeout(actionErrorTimerRef.current);
      actionErrorTimerRef.current = null;
    }
    setGameEndedResult(null);
    setRematchOffered(false);
    setRematchGameId(null);
    setDropNotice(null);
setOpponentGrace({});
    setAfkWarning(null);
    setLastFinished(null);
  }, [gameId]);

  /**
   * Terminal server rejection.
   *
   * Context decides the severity, not the code: with an authoritative board in
   * hand the game is live, so the error rejected one ACTION (illegal move, not
   * your turn) and becomes a transient card notice. With no board yet the join
   * itself failed, which is terminal and stays a joinError.
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
      if (error.code === 'UNAUTHENTICATED') {
        // Credential death, not a rules rejection: never an actionError
        // click on a "broken" board while the clock runs out. Silent
        // refresh-once (guests) keeps the tail — same userId, so resubmits
        // stay valid — and rejoins with no error at all. Otherwise a
        // persistent joinError with honest copy (guests have no sign-in).
        // The pending tail is kept for the rejoin and cleared only if the
        // recovery itself fails.
        void (async () => {
          const ok = await refreshSessionOnce().catch(() => false);
          if (ok) {
            joinGame(false);
            return;
          }
          setPending([]);
          const msg =
            getIdentity()?.isGuest === false
              ? 'Session expired — sign in again.'
              : 'Session expired. Restart the app to play again.';
          setJoinError(msg);
          setIsSyncing(false);
        })();
        if (onError) onError(error);
        return;
      }
      setPending([]);
      // isSyncing MUST be cleared here: the GameScreen overlay renders purely
      // off that flag, so leaving it true pins the player on "Connecting to
      // match" indefinitely with no message, while their clock runs down and
      // the game is eventually forfeited in their name.
      const messages: Record<string, string> = {
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
      setPending([]);
      // Context decides the severity (see classifyGameError): an error that
      // lands while a join is still unanswered rejected the JOIN — terminal,
      // even when a stale board from a previous game is on screen. Anything
      // later rejected one action on a live channel.
      if (classifyGameError({ joinOutstanding: joinOutstandingRef.current, hasBoard: !!gameStateRef.current }) === 'join') {
        setJoinError(message);
        setIsSyncing(false);
      } else {
        // Settled channel: the error rejected one action, not the join.
        // Transient notice — the match goes on.
        const nonce = Date.now();
        setActionError({ message, nonce });
        if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
        actionErrorTimerRef.current = setTimeout(() => {
          setActionError((prev) => (prev?.nonce === nonce ? null : prev));
        }, 4000);
      }
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
      // The join has its answer: later errors are about actions, not entry.
      joinOutstandingRef.current = false;
      setGameState(sync.state);

      // The seat -> account map rides along with every sync. Keep it: the
      // opponent's chips need a userId to open a profile, and this is the
      // only place it exists (a board seat id is not a user id).
      if (sync.playerUserIds) setPlayerUserIds(sync.playerUserIds);
      // Premium seat flags ride the same syncs (P5.2). Same absent-tolerant
      // rule: present replaces, absent (old server) keeps prior state.
      if (sync.premiumUserIds !== undefined) setPremiumUserIds(sync.premiumUserIds);

      // Current turn's inactivity deadline, when one applies: a client that
      // attaches (or re-attaches) mid-turn missed the one-shot warning, so
      // it picks up the same card countdown from here. No deadline means no
      // watchdog — clear anything stale rather than counting down to nothing.
      if (sync.afk) {
        const left = Math.max(0, Math.ceil((sync.afk.afkEndsAt - serverNow()) / 1000));
        setAfkWarning(
          left > 0
            ? { playerId: sync.afk.playerId, afkEndsAt: sync.afk.afkEndsAt, secondsRemaining: left }
            : null
        );
      } else {
        setAfkWarning(null);
      }

      // Grace truth, whole table including our own seat: a (re)joining client
      // missed the one-shot broadcasts and would otherwise show no countdown
      // — least of all for the deadline it is itself racing. A present list
      // (even empty) replaces the map; an absent list (old server) leaves it.
      if (sync.grace !== undefined) {
        const next: Record<string, OpponentGrace> = {};
        for (const ge of sync.grace) {
          next[ge.userId] = {
            userId: ge.userId,
            playerId: ge.playerId,
            graceEndsAt: ge.graceEndsAt,
            seconds: Math.max(0, Math.ceil((ge.graceEndsAt - serverNow()) / 1000)),
          };
        }
        setOpponentGrace(next);
      }

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
      // The table is decided: no seat is away or idle any more, so their
      // indicators must not outlive the game onto the result screen.
      setOpponentGrace({});
      setAfkWarning(null);
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
      // seat must never raise an indicator telling you the opponent left — or
      // arm a grace countdown against yourself while you are standing there.
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      // Absence and idling are mutually exclusive for one seat: a player who
      // is away cannot also be idle, and showing both indicators at once would
      // be a lie about which one the server is actually counting down.
      setAfkWarning(null);
      setOpponentGrace((prev) => ({
        ...prev,
        [payload.userId]: {
          userId: payload.userId,
          playerId: payload.playerId ?? null,
          graceEndsAt: payload.graceEndsAt,
          seconds: Math.max(0, Math.ceil((payload.graceEndsAt - serverNow()) / 1000)),
        },
      }));
    };

    const handleOpponentReconnected = (payload: { userId?: string; playerId?: string } = {}) => {
      // Symmetric: a reconnect event about your own seat must not cancel a
      // real opponent's countdown — and on a 3P/4P table it must not cancel
      // ANOTHER away seat's countdown either. Only that user's key goes.
      if (isOwnSeatEvent(payload, myPlayerIdRef.current)) return;
      if (payload.userId) {
        setOpponentGrace((prev) => {
          if (!prev[payload.userId!]) return prev;
          const next = { ...prev };
          delete next[payload.userId!];
          return next;
        });
      }
      // Coming back clears the absence; whether they are idle is the server's
      // call from here, so drop any stale AFK warning too rather than
      // leaving a countdown on screen for a player who just reconnected.
      setAfkWarning(null);
    };

    /**
     * Inactivity notice for the seat on turn. Fires once per turn, with the
     * full allowance — the countdown on the card IS the warning.
     *
     * Deliberately NOT filtered by seat: the player sitting in the warned
     * seat must see their own countdown. Dropping own-seat events is what
     * left idle players with no warning at all while their opponents watched
     * one.
     */
    const handleAfkWarning = (payload: { playerId?: string; afkEndsAt?: number; secondsRemaining: number }) => {
      // An absent table is not an idle one: while ANY seat is away, absence
      // owns every outcome and no AFK watchdog can be live server-side.
      if (Object.keys(opponentGraceRef.current).length > 0) return;
      const afkEndsAt =
        payload.afkEndsAt ?? serverNow() + Math.max(0, payload.secondsRemaining) * 1000;
      setAfkWarning({
        playerId: payload.playerId ?? null,
        afkEndsAt,
        secondsRemaining: Math.max(0, Math.ceil((afkEndsAt - serverNow()) / 1000)),
      });
    };

    const handleAfkCleared = (_payload: { playerId?: string } = {}) => {
      // A warning only ever names the seat on turn, and only one seat is
      // ever warned at a time — any clear (including your own move) ends it.
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

    const handleRematchDeclined = () => {
      // The other side dismissed the offer: stop waiting now instead of
      // idling out the server TTL. The screen clears its sent state.
      setRematchDeclinedNonce((n) => n + 1);
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
    socket.on('game:rematchDeclined', handleRematchDeclined);
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
      socket.off('game:rematchDeclined', handleRematchDeclined);
      socket.off('matchmaking:matched', handleRematchMatched);
      socket.off('game:playerFinished', handleFinished);
      socket.off('game:error', handleError);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      if (afkTimerRef.current) clearInterval(afkTimerRef.current);
      if (rematchTimerRef.current) clearTimeout(rematchTimerRef.current);
      if (actionErrorTimerRef.current) clearTimeout(actionErrorTimerRef.current);
    };
    // Deliberately NOT depending on the handlers: `onError` is typically an
    // inline arrow from GameScreen, so listing it would re-register every
    // socket listener on every render of the screen. The handlers read only
    // refs and setters that are stable for the life of the subscription.
    // `identity?.userId` (not displayName): a rename must not rejoin the
    // match — syncIdentity already refreshes the name server-side.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, identity?.userId, joinGame, onGameEnded]);

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

  /**
   * Explicitly dismiss an incoming rematch offer: clears it locally AND tells
   * the server, so the offeror stops waiting out the 30s TTL. Fire-and-forget
   * by design — the local state is already correct even if the emit drops.
   */
  const declineRematch = useCallback(() => {
    setRematchOffered(false);
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
      rematchTimerRef.current = null;
    }
    try {
      socketManager.getSocket().emit('game:rematchDecline', { gameId });
    } catch {
      // Local state already dismissed; the server TTL is the backstop.
    }
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
    /** UserIds premium at creation (P5.2 seat/GameOver badges, frozen). */
    premiumUserIds,
connStatus,
    /** OS link verdict: true while the OS reports no usable connection. */
    linkDown,
    rematchOffered,
    rematchOfferNonce,
    rematchDeclinedNonce,
    rematchGameId,
    gameEndedResult,
    isSyncing,
    joinError,
    /** Transient rejected-action notice for the player's own card. */
    actionError,
    /** A queued move the transport discarded after optimistic display. */
    dropNotice,
    pendingCount,
    lastFinished,
    sendAction,
    resign,
    offerRematch,
    declineRematch,
    resync: joinGame,
    getSyncClockMs,
  };
}
