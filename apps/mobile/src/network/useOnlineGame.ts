import { useEffect, useRef, useState, useCallback } from 'react';
import { GameAction, GameError, GameState, RecordedAction, applyAction } from '@duoorb/game-core';
import { ClockStateDto, GameEndedDto, GameSyncDto } from '@duoorb/protocol';
import { socketManager, ConnectionStatus } from './socket';
import { getCurrentUser } from './auth';

export interface UseOnlineGameOptions {
  gameId: string;
  onGameEnded?: (result: GameEndedDto) => void;
  onError?: (error: GameError) => void;
}

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

export function useOnlineGame({ gameId, onGameEnded, onError }: UseOnlineGameOptions) {
  const currentUser = getCurrentUser();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [clocks, setClocks] = useState<Record<string, number>>({});
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<number>(0);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [opponentGrace, setOpponentGrace] = useState<{ userId: string; seconds: number } | null>(null);
  const [rematchOffered, setRematchOffered] = useState<boolean>(false);
  const [rematchOfferNonce, setRematchOfferNonce] = useState<number>(0);
  const [rematchGameId, setRematchGameId] = useState<string | null>(null);
  const rematchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameEndedResult, setGameEndedResult] = useState<GameEndedDto | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastFinished, setLastFinished] = useState<{ gameId: string; playerId: string; userId: string; place: number } | null>(null);

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
  const clockAnchorRef = useRef<{ remainingMs: Record<string, number>; at: number } | null>(null);
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
    socket.emit('game:join', {
      gameId,
      lastSequence: gameStateRef.current?.history.length ?? 0,
      pendingActions: (pendingRef.current[gameId] ?? []).map((p) => ({
        clientActionId: p.clientActionId,
        action: p.action,
      })),
    });
  }, [gameId]);

  // Rejoin + resync automatically after a transport reconnect (e.g. fresh
  // token). Skipped on first connect — mount already joins.
  useEffect(() => {
    if (connStatus === 'connected') {
      if (everConnectedRef.current) joinGame();
      everConnectedRef.current = true;
    }
  }, [connStatus, joinGame]);

  useEffect(() => {
    const socket = socketManager.getSocket();
    const unsubStatus = socketManager.subscribeStatus(setConnStatus);

    joinGame();

    const handleSync = (sync: GameSyncDto) => {
      setIsSyncing(false);
      setGameState(sync.state);

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

      // Resolve myPlayerId & seat
      if (sync.playerUserIds) {
        for (const [pId, uId] of Object.entries(sync.playerUserIds)) {
          if (uId === currentUser.userId) {
            setMyPlayerId(pId);
            const idx = sync.state.players.findIndex((p) => p.id === pId);
            if (idx >= 0) setMyPlayerIndex(idx);
            break;
          }
        }
      } else {
        // Fallback: match by displayName
        const idx = sync.state.players.findIndex((p) => p.displayName === currentUser.displayName);
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
  }, [gameId, currentUser.userId, currentUser.displayName, joinGame, onGameEnded, onError]);

  const sendAction = useCallback(
    (action: GameAction) => {
      const socket = socketManager.getSocket();
      // Idempotency key + expected sequence: mobile retries replay the
      // original server result instead of double-applying. The entry stays
      // queued until the accepted echo (or a sync) proves it settled.
      actionCounterRef.current += 1;
      const historyLen = gameStateRef.current?.history.length ?? 0;
      const clientActionId = `${currentUser.userId}-${Date.now()}-${actionCounterRef.current}`;
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
    [gameId]
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
    connStatus,
    opponentGrace,
    rematchOffered,
    rematchOfferNonce,
    rematchGameId,
    gameEndedResult,
    isSyncing,
    pendingCount,
    lastFinished,
    sendAction,
    resign,
    offerRematch,
    resync: joinGame,
  };
}
