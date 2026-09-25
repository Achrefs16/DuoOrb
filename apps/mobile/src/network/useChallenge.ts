import { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode } from '@duoorb/game-core';
import { ChallengeDto } from '@duoorb/protocol';
import { TimeControl } from '../timeControls';
import { socketManager } from './socket';

export interface OutgoingChallenge {
  challenge: ChallengeDto;
  toName: string;
}

interface UseChallengeOptions {
  onGameStart: (gameId: string, mode: GameMode, clock: TimeControl) => void;
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

  const sendChallenge = useCallback(
    (
      toUserId: string,
      toName: string,
      opts: { mode: GameMode; clock: TimeControl; wallsEach: number }
    ) => {
      const socket = socketManager.getSocket();
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

    const onReceived = (c: ChallengeDto) => setIncoming(c);
    const onAccepted = (p: {
      challengeId: string;
      gameId: string;
      mode: GameMode;
      timeControlMinutes: number;
      incrementSeconds: number;
    }) => {
      setIncoming(null);
      setOutgoing(null);
      onGameStartRef.current(p.gameId, p.mode, clockFromParts(p.timeControlMinutes, p.incrementSeconds));
    };
    const onDeclined = (p: { challengeId: string }) => {
      setOutgoing((prev) => {
        if (prev && prev.challenge.id === p.challengeId) {
          flashNotice('Challenge declined.');
          return null;
        }
        return prev;
      });
    };
    const onExpired = (p: { challengeId: string }) => {
      setOutgoing((prev) => (prev && prev.challenge.id === p.challengeId ? null : prev));
      setIncoming((prev) => {
        if (prev && prev.id === p.challengeId) {
          flashNotice('Challenge expired.');
          return null;
        }
        return prev;
      });
    };
    const onCancelled = (p: { challengeId: string }) => {
      setIncoming((prev) => {
        if (prev && prev.id === p.challengeId) {
          flashNotice('Challenge withdrawn.');
          return null;
        }
        return prev;
      });
      setOutgoing((prev) => {
        if (prev && prev.challenge.id === p.challengeId) {
          flashNotice('Challenge replaced.');
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
  }, [flashNotice]);

  return { incoming, outgoing, notice, sendChallenge, respond, cancelWaiting };
}
