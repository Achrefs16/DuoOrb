import { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode } from '@duoorb/game-core';
import { TimeControl } from '../timeControls';
import { socketManager, useVerified } from './socket';

export type MatchmakingState = 'idle' | 'searching' | 'matched';

export interface MatchedOpponent {
  userId: string;
  displayName: string;
  rating: number;
  isPremium?: boolean;
}

interface UseMatchmakingOptions {
  onMatched: (gameId: string, opponents: MatchedOpponent[]) => void;
}

export function useMatchmaking({ onMatched }: UseMatchmakingOptions) {
  const [state, setState] = useState<MatchmakingState>('idle');
  const [searchSeconds, setSearchSeconds] = useState(0);
  /**
   * Matchmaking is an authenticated request. `connected` only means the
   * transport opened; the server may still be verifying the token. Waiting
   * for this flag is what stops the auto-start search from being rejected
   * before the handshake publishes the user route.
   */
  const verified = useVerified();
  const onMatchedRef = useRef(onMatched);
  useEffect(() => {
    onMatchedRef.current = onMatched;
  }, [onMatched]);
  /** Set by the one stable subscription below; ack/event both route through it. */
  const matchedHandlerRef = useRef<((gameId: string, opponents: MatchedOpponent[]) => void) | null>(
    null
  );
  const matchedGameRef = useRef<string | null>(null);
  // ONLINE_HEALTH Phase D: searching with zero feedback is how dead sockets
  // and empty queues both look. After two minutes the UI says so honestly
  // (config/rating/table hint) while the search itself keeps running — 3P/4P
  // tables legitimately wait, so this never auto-cancels.
  const [takingLong, setTakingLong] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Reconciliation tick: re-announcing the same search is idempotent on the
   * server (preserved queue position) and, if the game already exists, makes
   * the server auto-route it. This is the recovery path for a matched event
   * that was lost to a stale socket or a detached listener.
   */
  const findTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<MatchmakingState>('idle');
  const lastFind = useRef<{ mode: GameMode; clock: TimeControl; wallsEach: number } | null>(null);
  const wasDown = useRef(false);
  /** True once the current search intent has actually reached the wire. */
  const findSent = useRef(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (longRef.current) {
      clearTimeout(longRef.current);
      longRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    if (findTimerRef.current) {
      clearInterval(findTimerRef.current);
      findTimerRef.current = null;
    }
  }, []);

  /**
   * Sends the current search only when the server has verified this
   * transport. Returns false when the intent must wait for authState.
   */
  const sendFind = useCallback(
    (config: { mode: GameMode; clock: TimeControl; wallsEach: number }): boolean => {
      if (socketManager.isVerified() !== true) return false;
      findSent.current = true;
      socketManager.getSocket().emit(
        'matchmaking:find',
        {
          mode: config.mode,
          timeControlMinutes: config.clock.minutes,
          incrementSeconds: config.clock.incrementSeconds ?? 0,
          wallsEach: config.wallsEach,
        },
        (res: {
          success?: boolean;
          queued?: boolean;
          resumed?: boolean;
          gameId?: string;
          opponents?: MatchedOpponent[];
          code?: string;
        }) => {
          // The ack is a second delivery path for the resume case: if the
          // one-shot matched event was missed, this still gets the player
          // into the game the server already created. Ignore an ack that
          // arrives after the player cancelled or already navigated.
          if (res?.resumed && res.gameId && stateRef.current === 'searching') {
            matchedHandlerRef.current?.(res.gameId, res.opponents ?? []);
          }
        }
      );
      return true;
    },
    []
  );

  const startSearch = useCallback(
    (mode: GameMode, clock: TimeControl, wallsEach = 10) => {
      const config = { mode, clock, wallsEach };
      lastFind.current = config;
      wasDown.current = false;
      findSent.current = false;
      matchedGameRef.current = null;
      stateRef.current = 'searching';
      setState('searching');
      setSearchSeconds(0);
      setTakingLong(false);
      stopTimer();

      timerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);
      longRef.current = setTimeout(() => {
        if (stateRef.current === 'searching') setTakingLong(true);
      }, 120000);
      findTimerRef.current = setInterval(() => {
        if (stateRef.current !== 'searching' || !lastFind.current) return;
        if (socketManager.isVerified() !== true) return;
        sendFind(lastFind.current);
      }, 12000);

      // If the socket is still connecting/verifying, this returns false and
      // the verified effect below sends the same intent exactly once.
      sendFind(config);
    },
    [sendFind, stopTimer]
  );

  const cancelMatch = useCallback(() => {
    // Cancel is only meaningful once the server knows about the search, but
    // send it whenever the transport can carry it; the server handler is
    // idempotent and a disconnect already removes the queue entry.
    if (socketManager.isVerified() === true) {
      socketManager.getSocket().emit('matchmaking:cancel');
    }
    lastFind.current = null;
    wasDown.current = false;
    findSent.current = false;
    matchedGameRef.current = null;
    stopTimer();
    stateRef.current = 'idle';
    setState('idle');
    setSearchSeconds(0);
    setTakingLong(false);
  }, [stopTimer]);

  const findMatch = startSearch;

  // A quick-search auto-start can happen while the transport is still
  // connecting or verifying. Keep the intent and send it exactly once when
  // the server proves the session. This is the missing retry that used to
  // leave one device on the radar forever.
  useEffect(() => {
    if (verified !== true) {
      findSent.current = false;
      return;
    }
    if (stateRef.current === 'searching' && lastFind.current && !findSent.current) {
      sendFind(lastFind.current);
    }
  }, [verified, sendFind]);

  useEffect(() => {
    const socket = socketManager.getSocket();

    const handleMatched = (payload: { gameId: string; opponents?: MatchedOpponent[] }) => {
      // Event and find-ack are two delivery paths for the same match. Make
      // the transition idempotent so a recovered ack cannot navigate twice.
      if (matchedGameRef.current === payload.gameId) return;
      matchedGameRef.current = payload.gameId;
      stopTimer();
      lastFind.current = null;
      wasDown.current = false;
      findSent.current = false;
      stateRef.current = 'matched';
      setState('matched');
      setTakingLong(false);
      // Read through a ref: this effect must not resubscribe every time the
      // parent re-renders (~once per search-second), or a one-shot matched
      // event can land in the off/on gap and be lost.
      onMatchedRef.current(payload.gameId, payload.opponents ?? []);
    };
    matchedHandlerRef.current = (gameId, opponents) =>
      handleMatched({ gameId, opponents });

    const handleGameError = (error: { code?: string }) => {
      if (stateRef.current !== 'searching') return;
      if (error.code === 'UNAUTHENTICATED') {
        // The transport may have reconnected between our emit and the
        // server's handler. Keep the intent and retry once the same verified
        // socket is in place; the verified effect covers a full reconnect.
        findSent.current = false;
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          if (
            stateRef.current === 'searching' &&
            lastFind.current &&
            socketManager.isVerified() === true
          ) {
            sendFind(lastFind.current);
          }
        }, 500);
      }
    };

    // Connection dropped mid-search: the server threw our queue note
    // away. Re-fire the same search on reconnect instead of spinning.
    const unsubStatus = socketManager.subscribeStatus((s) => {
      if (s === 'connected' && wasDown.current) {
        wasDown.current = false;
        if (stateRef.current === 'searching' && lastFind.current) {
          findSent.current = false;
          // Usually the handshake verdict has not arrived yet; the verified
          // effect sends it. If it has, send now.
          if (socketManager.isVerified() === true) sendFind(lastFind.current);
        }
      } else if (s === 'disconnected' || s === 'reconnecting') {
        if (stateRef.current === 'searching') {
          wasDown.current = true;
          findSent.current = false;
        }
      }
    });

    socket.on('matchmaking:matched', handleMatched);
    socket.on('game:error', handleGameError);

    return () => {
      unsubStatus();
      socket.off('matchmaking:matched', handleMatched);
      socket.off('game:error', handleGameError);
      matchedHandlerRef.current = null;
      stopTimer();
    };
  }, [stopTimer, startSearch, sendFind]);

  return {
    state,
    searchSeconds,
    takingLong,
    findMatch,
    cancelMatch,
  };
}
