import { useCallback, useEffect, useRef, useState } from 'react';
import { socketManager } from './socket';

/**
 * Ephemeral quick reactions for live online matches — plus the 2p AI
 * sparring tray used for local testing.
 *
 * One Socket.IO event (`game:reaction`) in each direction, on the existing
 * connection: emits carry `{ gameId, reaction }`, relays arrive as
 * `{ gameId, reaction, fromUserId }`. Nothing is stored, nothing touches
 * game state, clock, rating or history — the server relays to the other
 * seats and forgets.
 *
 * Online-only sockets by construction: the listener subscribes only while
 * `enabled` with a live socket, and `send` no-ops otherwise. AI matches have
 * no socket at all: a tap still confirms locally through `echo` (your side),
 * and the engine's own banter shows through `preview` (their side). Local,
 * replay and analysis never attach anything.
 */

export type ReactionKind = 'laugh' | 'wow' | 'cry' | 'angry' | 'clap' | 'fire';

/** Platform emoji glyphs, one per meaning — no icon-font approximations. */
export const REACTION_EMOJI: Record<ReactionKind, string> = {
  laugh: '😂',
  wow: '😮',
  cry: '😭',
  angry: '😡',
  clap: '👏',
  fire: '🔥',
};

export const REACTION_ORDER: ReactionKind[] = ['laugh', 'wow', 'cry', 'angry', 'clap', 'fire'];

const REACTION_LABELS: Record<ReactionKind, string> = {
  laugh: 'laughing',
  wow: 'surprised',
  cry: 'crying',
  angry: 'angry',
  clap: 'clapping',
  fire: 'fire',
};

export function reactionLabel(kind: ReactionKind): string {
  return REACTION_LABELS[kind];
}

function isReactionKind(value: unknown): value is ReactionKind {
  return (
    value === 'laugh' ||
    value === 'wow' ||
    value === 'cry' ||
    value === 'angry' ||
    value === 'clap' ||
    value === 'fire'
  );
}

export interface IncomingReaction {
  id: number;
  kind: ReactionKind;
}

/** Max bubbles stacked in the receiving area: newer ones evict older. */
const MAX_STACK = 2;

interface UseQuickReactionsOptions {
  /** UI visible (online live match, or AI match for local testing). */
  enabled: boolean;
  /** Socket live: online matches only. AI taps echo locally instead. */
  socketLive: boolean;
  gameId: string;
  myUserId: string | null;
}

export function useQuickReactions({ enabled, socketLive, gameId, myUserId }: UseQuickReactionsOptions) {
  const [incoming, setIncoming] = useState<IncomingReaction[]>([]);
  // Your own taps, shown on your side of the board (never sent, never
  // relayed): the confirmation that the reaction actually went out.
  const [outgoing, setOutgoing] = useState<IncomingReaction[]>([]);
  const idRef = useRef(0);

  const pushInto = useCallback(
    (setList: (updater: (prev: IncomingReaction[]) => IncomingReaction[]) => void, kind: ReactionKind) => {
      if (!enabled || !isReactionKind(kind)) return;
      idRef.current += 1;
      const item: IncomingReaction = { id: idRef.current, kind };
      setList((prev) => [...prev.slice(-(MAX_STACK - 1)), item]);
    },
    [enabled]
  );

  /** Opponent-side bubble (relayed online, or the engine's own banter). */
  const preview = useCallback(
    (kind: ReactionKind) => {
      pushInto(setIncoming, kind);
    },
    [pushInto]
  );

  /** Your own bubble, on your side: the local send confirmation. */
  const echo = useCallback(
    (kind: ReactionKind) => {
      pushInto(setOutgoing, kind);
    },
    [pushInto]
  );

  useEffect(() => {
    if (!enabled || !socketLive || !gameId) return;
    const socket = socketManager.getSocket();
    const onReaction = (p: { gameId?: string; reaction?: string; fromUserId?: string }) => {
      if (!p || p.gameId !== gameId) return;
      if (p.fromUserId && myUserId && p.fromUserId === myUserId) return;
      if (!isReactionKind(p.reaction)) return;
      preview(p.reaction);
    };
    socket.on('game:reaction', onReaction);
    return () => {
      socket.off('game:reaction', onReaction);
    };
  }, [enabled, socketLive, gameId, myUserId, preview]);

  // Ids are unique across both lists, so either list can dismiss its own bubble.
  const dismiss = useCallback((id: number) => {
    setIncoming((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const dismissOutgoing = useCallback((id: number) => {
    setOutgoing((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const send = useCallback(
    (kind: ReactionKind) => {
      if (!enabled || !socketLive || !gameId) return;
      try {
        socketManager.getSocket().emit('game:reaction', { gameId, reaction: kind });
      } catch {
        // Ephemeral by design: a failed send is dropped, never retried.
      }
    },
    [enabled, socketLive, gameId]
  );

  // `preview` fills the opponent dock (relayed online, or the engine's
  // banter); `echo` fills your own as the local send confirmation.
  return { incoming, outgoing, dismiss, dismissOutgoing, send, preview, echo };
}
