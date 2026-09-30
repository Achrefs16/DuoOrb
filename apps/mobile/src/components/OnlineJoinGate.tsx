import React, { useEffect, useRef } from 'react';
import type { GameSyncDto } from '@duoorb/protocol';
import type { GameError } from '@duoorb/game-core';
import { socketManager } from '../network/socket';
import { useOnlineGame } from '../network/useOnlineGame';

interface OnlineJoinGateProps {
  gameId: string;
  /**
   * Fires exactly once, with the first sync that carries our seat — the
   * earliest moment the board can render. No delays, no safety-net timers:
   * if the join never lands, this never fires and the caller keeps its own
   * waiting UI (with cancel) instead of entering a dead game.
   */
  onSynced: (sync: GameSyncDto) => void;
  /** Fires once when the server definitively rejects the join. */
  onFailed?: (error: GameError) => void;
}

/**
 * Headless join: runs the normal game channel (join + sync) with no UI, so
 * the pre-game screen hands off only once the match is actually joined.
 * The first sync snapshot is handed up with the handoff, so the game screen
 * renders the board on its first frame — there is deliberately no
 * "connecting" state anywhere past this gate.
 *
 * Unmounting releases the seat: a cancelled gate must not leave the player
 * seated in a live game with their clock running.
 */
export const OnlineJoinGate: React.FC<OnlineJoinGateProps> = ({
  gameId,
  onSynced,
  onFailed,
}) => {
  const online = useOnlineGame({ gameId });
  const firedRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onSyncedRef.current = onSynced;
    onFailedRef.current = onFailed;
  });

  const hasSeat = !!online.myPlayerId;
  const getClockMs = online.getSyncClockMs;
  useEffect(() => {
    if (firedRef.current || !online.gameState || !hasSeat) return;
    firedRef.current = true;
    onSyncedRef.current({
      state: online.gameState,
      clock: {
        activePlayerIndex: online.gameState.currentPlayerIndex,
        remainingMs: getClockMs(),
        serverTimestamp: Date.now(),
      },
      // A full-state handoff: nothing is missing by construction. The mount
      // join in the game screen replays the tail if anything moved since.
      missingActions: [],
      playerUserIds: online.playerUserIds,
      you: online.myPlayerId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online.gameState, hasSeat]);

  // Surface a terminal rejection (unseated, expired session, gone game) so
  // the caller can explain it instead of waiting forever.
  const joinError = online.joinError;
  useEffect(() => {
    if (firedRef.current || !joinError) return;
    firedRef.current = true;
    onFailedRef.current?.({ code: 'GAME_NOT_IN_PROGRESS', message: joinError });
  }, [joinError]);

  // Leaving the gate WITHOUT a handoff (cancel, navigate away) frees a seat
  // we may hold. But a SUCCESSFUL handoff must NOT leave: the game screen's
  // hook takes over the same socket channel, and game:leave on a live
  // seated game resigns it — we would forfeit our own fresh match in the
  // gap between unmount and the next join. firedRef covers both outcomes
  // (synced and failed), so only a true early exit releases.
  useEffect(() => {
    return () => {
      if (firedRef.current) return;
      try {
        socketManager.getSocket().emit('game:leave', { gameId });
      } catch {
        // offline — server grace path covers it
      }
    };
  }, [gameId]);

  return null;
};
