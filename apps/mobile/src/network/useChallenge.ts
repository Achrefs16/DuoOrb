import { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode } from '@duoorb/game-core';
import { ChallengeDto, GameSyncDto } from '@duoorb/protocol';
import { TimeControl } from '../timeControls';
import { socketManager } from './socket';
import { playNotifySound } from '../audio/sounds';

export interface OutgoingChallenge {
  challenge: ChallengeDto;
  toName: string;
}

interface UseChallengeOptions {
  onGameStart: (
    gameId: string,
    mode: GameMode,
    clock: TimeControl,
    initialSync?: GameSyncDto | null
  ) => void;
}

function clockFromParts(minutes: number, incrementSeconds: number): TimeControl {
  return {
    id: `custom-${minutes}-${incrementSeconds}`,
    name: `Custom ${minutes}+${incrementSeconds}`,
    short: `${minutes}+${incrementSeconds}`,
    minutes,
    incrementSeconds,
  };
}

export function useChallenge({ onGameStart }: UseChallengeOptions) {
  const [incoming, setIncoming] = useState<ChallengeDto | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingChallenge | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * Accepted challenge waiting on its first sync. The game screen is entered
   * only after the join gate confirms it — accepting must never drop the
   * player onto a connecting page. Null when not joining.
   */
  const [joining, setJoining] = useState<{
    gameId: string;
    mode: GameMode;
    clock: TimeControl;
  } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref: resubscribing listeners on every parent render would
  // clear the notice dismiss-timer and stick every toast forever.
  const onGameStartRef = useRef(onGameStart);
  onGameStartRef.current = onGameStart;

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2000);
  }, []);

  const lastPing = useRef<string | null>(null);
  /**
   * One audible ping per server event. State updaters may run twice in dev
   * StrictMode, and expired/cancelled clear two seats for a single event —
   * the key makes the ping idempotent so neither case double-plays.
   */
  const pingOnce = useCallback((key: string) => {
    if (lastPing.current === key) return;
    lastPing.current = key;
    void playNotifySound();
  }, []);

  const sendChallenge = useCallback(
    (
      toUserId: string,
      toName: string,
      opts: { mode: GameMode; clock: TimeControl; wallsEach: number }
    ) => {
      const socket = socketManager.getSocket();
      // ONLINE_HEALTH Phase B: ack watchdog. A dropped emit (dead socket) or
      // a server that never answers previously left zero feedback — no card,
      // no error. 20s with no ack is an answer: the request went nowhere.
      let answered = false;
      const watchdog = setTimeout(() => {
        if (!answered) {
          answered = true;
          flashNotice('No answer from the server. Check your connection and try again.');
        }
      }, 20000);
      socket.emit(
        'challenge:send',
        {
          toUserId,
          mode: opts.mode,
          timeControlMinutes: opts.clock.minutes,
          incrementSeconds: opts.clock.incrementSeconds ?? 0,
          wallsEach: opts.wallsEach,
        },
        (res) => {
          if (answered) return;
          answered = true;
          clearTimeout(watchdog);
          if (res?.success && res.challenge) {
            setOutgoing({ challenge: res.challenge, toName });
          } else {
            flashNotice(res?.error ?? 'Could not send challenge.');
          }
        }
      );
    },
    [flashNotice]
  );

  const respond = useCallback((accept: boolean) => {
    setIncoming((prev) => {
      if (prev) {
        socketManager.getSocket().emit('challenge:respond', { challengeId: prev.id, accept });
      }
      return null;
    });
  }, []);

  const cancelWaiting = useCallback(() => {
    setOutgoing((prev) => {
      if (prev) {
        socketManager.getSocket().emit('challenge:cancel', { challengeId: prev.challenge.id });
      }
      return null;
    });
  }, []);

  useEffect(() => {
    const socket = socketManager.getSocket();

    const onReceived = (c: ChallengeDto) => {
      setIncoming(c);
      void playNotifySound();
    };
    const onAccepted = (p: {
      challengeId: string;
      gameId: string;
      mode: GameMode;
      timeControlMinutes: number;
      incrementSeconds: number;
    }) => {
      setIncoming(null);
      setOutgoing(null);
      // Hold the handoff until the join gate (rendered by App) confirms the
      // sync with a snapshot. The toast shows a joining state meanwhile.
      setJoining({
        gameId: p.gameId,
        mode: p.mode,
        clock: clockFromParts(p.timeControlMinutes, p.incrementSeconds),
      });
    };
    const onDeclined = (p: { challengeId: string }) => {
      setOutgoing((prev) => {
        if (prev && prev.challenge.id === p.challengeId) {
          flashNotice('Challenge declined.');
          pingOnce(`declined:${p.challengeId}`);
          return null;
        }
        return prev;
      });
    };
    const onExpired = (p: { challengeId: string }) => {
      setOutgoing((prev) => {
        if (prev && prev.challenge.id === p.challengeId) {
          flashNotice('Challenge expired.');
          pingOnce(`expired:${p.challengeId}`);
          return null;
        }
        return prev;
      });
      setIncoming((prev) => {
        if (prev && prev.id === p.challengeId) {
          flashNotice('Challenge expired.');
          pingOnce(`expired:${p.challengeId}`);
          return null;
        }
        return prev;
      });
    };
    const onCancelled = (p: { challengeId: string }) => {
      setIncoming((prev) => {
        if (prev && prev.id === p.challengeId) {
          flashNotice('Challenge withdrawn.');
          pingOnce(`cancelled:${p.challengeId}`);
          return null;
        }
        return prev;
      });
      setOutgoing((prev) => {
        if (prev && prev.challenge.id === p.challengeId) {
          flashNotice('Challenge replaced.');
          pingOnce(`cancelled:${p.challengeId}`);
          return null;
        }
        return prev;
      });
    };

    socket.on('challenge:received', onReceived);
    socket.on('challenge:accepted', onAccepted);
    socket.on('challenge:declined', onDeclined);
    socket.on('challenge:expired', onExpired);
    socket.on('challenge:cancelled', onCancelled);
    return () => {
      socket.off('challenge:received', onReceived);
      socket.off('challenge:accepted', onAccepted);
      socket.off('challenge:declined', onDeclined);
      socket.off('challenge:expired', onExpired);
      socket.off('challenge:cancelled', onCancelled);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [flashNotice, pingOnce]);

  /**
   * The gate confirmed the join: hand off with the board snapshot. Clears
   * the joining state first so the toast is gone before navigation lands.
   */
  const confirmJoining = useCallback(
    (sync: GameSyncDto) => {
      setJoining((prev) => {
        if (prev) onGameStartRef.current(prev.gameId, prev.mode, prev.clock, sync);
        return null;
      });
    },
    []
  );

  /**
   * Abandons a joining challenge (gate failure or user cancel). The gate's
   * unmount releases any seat it holds; the toast falls back to a notice so
   * the player knows the match didn't happen.
   */
  const cancelJoining = useCallback(
    (message?: string) => {
      setJoining((prev) => {
        if (prev && message) flashNotice(message);
        return null;
      });
    },
    [flashNotice]
  );

  return { incoming, outgoing, notice, joining, sendChallenge, respond, cancelWaiting, confirmJoining, cancelJoining };
}
