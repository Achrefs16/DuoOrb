import { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode } from '@duoorb/game-core';
import { TimeControl } from '../timeControls';
import { socketManager } from './socket';

export type MatchmakingState = 'idle' | 'searching' | 'matched';

export interface MatchedOpponent {
  userId: string;
  displayName: string;
  rating: number;
}

interface UseMatchmakingOptions {
  onMatched: (gameId: string, opponents: MatchedOpponent[]) => void;
}

export function useMatchmaking({ onMatched }: UseMatchmakingOptions) {
  const [state, setState] = useState<MatchmakingState>('idle');
  const [searchSeconds, setSearchSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<MatchmakingState>('idle');
  const lastFind = useRef<{ mode: GameMode; clock: TimeControl; wallsEach: number } | null>(null);
  const wasDown = useRef(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startSearch = useCallback(
    (mode: GameMode, clock: TimeControl, wallsEach = 10) => {
      const socket = socketManager.getSocket();
      lastFind.current = { mode, clock, wallsEach };
      wasDown.current = false;
      stateRef.current = 'searching';
      setState('searching');
      setSearchSeconds(0);
      stopTimer();

      timerRef.current = setInterval(() => {
        setSearchSeconds((s) => s + 1);
      }, 1000);

      socket.emit('matchmaking:find', {
        mode,
        timeControlMinutes: clock.minutes,
        incrementSeconds: clock.incrementSeconds ?? 0,
        wallsEach,
      });
    },
    [stopTimer]
  );

  const cancelMatch = useCallback(() => {
    const socket = socketManager.getSocket();
    socket.emit('matchmaking:cancel');
    lastFind.current = null;
    wasDown.current = false;
    stopTimer();
    stateRef.current = 'idle';
    setState('idle');
    setSearchSeconds(0);
  }, [stopTimer]);

  const findMatch = startSearch;

  useEffect(() => {
    const socket = socketManager.getSocket();

    const handleMatched = (payload: { gameId: string; opponents?: MatchedOpponent[] }) => {
      stopTimer();
      lastFind.current = null;
      wasDown.current = false;
      stateRef.current = 'matched';
      setState('matched');
      onMatched(payload.gameId, payload.opponents ?? []);
    };

    // Connection dropped mid-search: the server threw our queue note
    // away. Re-fire the same search on reconnect instead of spinning.
    const unsubStatus = socketManager.subscribeStatus((s) => {
      if (s === 'connected' && wasDown.current) {
        wasDown.current = false;
        if (stateRef.current === 'searching' && lastFind.current) {
          startSearch(lastFind.current.mode, lastFind.current.clock, lastFind.current.wallsEach);
        }
      } else if (s === 'disconnected' || s === 'reconnecting') {
        if (stateRef.current === 'searching') wasDown.current = true;
      }
    });

    socket.on('matchmaking:matched', handleMatched);

    return () => {
      unsubStatus();
      socket.off('matchmaking:matched', handleMatched);
      stopTimer();
    };
  }, [onMatched, stopTimer, startSearch]);

  return {
    state,
    searchSeconds,
    findMatch,
    cancelMatch,
  };
}
