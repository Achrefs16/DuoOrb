import { useEffect, useRef, useState, useCallback } from 'react';
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
  const [opponentGrace, setOpponentGrace] = useState<{ userId: string; seconds: number } | null>(null);
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
  const [pendingCount, setPendingCount] = useState<number>(0);
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
  const pendingRef = useRef<
    Record<string, { clientActionId: string; expectedSequence: number; action: GameAction }[]>
  >({});
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

  // Grace timer countdown
  useEffect(() => {
    if (!opponentGrace) {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      return;
    }

    graceTimerRef.current = setInterval(() => {
      setOpponentGrace((prev) => {
        if (!prev || prev.seconds <= 1) {
          if (graceTimerRef.current) clearInterval(graceTimerRef.current);
          return null;
        }
        return { ...prev, seconds: prev.seconds - 1 };
      });
    }, 1000);

    return () => {
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
    };
  }, [opponentGrace?.userId]);

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
      socketManager.getSocket().emit('game:join', {
        gameId,
        lastSequence: gameStateRef.current?.history.length ?? 0,
      });
    }, JOIN_RETRY_MS);
    return () => clearInterval(timer);
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
    setLastFinished(null);
  }, [gameId]);

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
      const kept = (pendingRef.current[gameId] ?? []).filter((p) => p.expectedSequence > serverLen);
      if (kept.length !== (pendingRef.current[gameId] ?? []).length) {
        pendingRef.current = { ...pendingRef.current, [gameId]: kept };
      }
      setPendingCount(kept.length);

      // Convert ms clocks to seconds + anchor the display ticker.
      const secClocks: Record<string, number> = {};
      for (const [pId, ms] of Object.entries(sync.clock.remainingMs)) {
        secClocks[pId] = Math.ceil(ms / 1000);
      }
      setClocks(secClocks);
      clockAnchorRef.current = { remainingMs: { ...sync.clock.remainingMs }, at: Date.now() };

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

    const handleActionAccepted = (recorded: RecordedAction) => {
      // Exact confirmation match: drop the pending entry. Sequence-only
      // fallback is handled by the sync prune above.
      if ((recorded as { clientActionId?: string }).clientActionId) {
        const id = (recorded as { clientActionId?: string }).clientActionId!;
        const list = pendingRef.current[gameId] ?? [];
        if (list.some((p) => p.clientActionId === id)) {
          pendingRef.current = {
            ...pendingRef.current,
            [gameId]: list.filter((p) => p.clientActionId !== id),
          };
          setPendingCount((list.length - 1));
        }
      }
      setGameState((prev) => {
        if (!prev) return prev;
        // Own echo already applied optimistically with identical content.
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
    };

    const handleClock = (clock: ClockStateDto) => {
      const secClocks: Record<string, number> = {};
      for (const [pId, ms] of Object.entries(clock.remainingMs)) {
        secClocks[pId] = Math.ceil(ms / 1000);
      }
      setClocks(secClocks);
      clockAnchorRef.current = { remainingMs: { ...clock.remainingMs }, at: Date.now() };
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

    const handleOpponentDisconnected = (payload: { userId: string; gracePeriodSeconds: number }) => {
      setOpponentGrace({ userId: payload.userId, seconds: payload.gracePeriodSeconds });
    };

    const handleOpponentReconnected = () => {
      setOpponentGrace(null);
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

  const handleError = (error: GameError) => {
    console.warn('Game error from server:', error);
    // Our view of the sequence drifted (missed broadcast, reconnect):
    // pull full truth instead of acting on a stale board.
    if (error.code === 'STALE_SEQUENCE') {
      joinGame();
      return;
    }
    // Every other rejection is terminal for this join attempt. isSyncing MUST
    // be cleared here: the GameScreen overlay renders purely off that flag, so
    // leaving it true pins the player on "Connecting to match" indefinitely
    // with no message, while their clock runs down and the game is eventually
    // forfeited in their name.
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Your session expired. Reconnect and try again.',
      NOT_SEATED:
        'This match belongs to a different account. Go back and find a new opponent.',
      GAME_NOT_IN_PROGRESS: 'That match is no longer available. Go back and search again.',
      ALREADY_IN_GAME: 'You are already in a match. Finish it first.',
    };
    const message = messages[error.code] ?? 'Could not join that match. Go back and try again.';
    setJoinError(message);
    setIsSyncing(false);
    if (onError) onError(error);
  };

    socket.on('game:sync', handleSync);
    socket.on('game:actionAccepted', handleActionAccepted);
    socket.on('game:clock', handleClock);
    socket.on('game:ended', handleEnded);
    socket.on('game:opponentDisconnected', handleOpponentDisconnected);
    socket.on('game:opponentReconnected', handleOpponentReconnected);
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
      socket.off('game:rematchOffered', handleRematchOffered);
      socket.off('matchmaking:matched', handleRematchMatched);
      socket.off('game:playerFinished', handleFinished);
      socket.off('game:error', handleError);
      if (graceTimerRef.current) clearInterval(graceTimerRef.current);
      if (rematchTimerRef.current) clearTimeout(rematchTimerRef.current);
    };
  }, [gameId, identity?.userId, identity?.displayName, joinGame, onGameEnded, onError]);

  const sendAction = useCallback(
    (action: GameAction) => {
      const socket = socketManager.getSocket();
      // Idempotency key + expected sequence: mobile retries replay the
      // original server result instead of double-applying. The entry stays
      // queued until the accepted echo (or a sync) proves it settled.
      actionCounterRef.current += 1;
      const historyLen = gameStateRef.current?.history.length ?? 0;
      const clientActionId = `${identity?.userId ?? 'anon'}-${Date.now()}-${actionCounterRef.current}`;
      const expectedSequence = historyLen + 1;
      const list = pendingRef.current[gameId] ?? [];
      const nextList = [...list.slice(-19), { clientActionId, expectedSequence, action }];
      pendingRef.current = { ...pendingRef.current, [gameId]: nextList };
      setPendingCount(nextList.length);
      socket.emit('game:action', {
        gameId,
        action,
        clientTimestamp: Date.now(),
        clientActionId,
        expectedSequence,
      });
    },
    [gameId, identity?.userId]
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
    clocks,
    myPlayerId,
    myPlayerIndex,
    playerUserIds,
    connStatus,
    opponentGrace,
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
