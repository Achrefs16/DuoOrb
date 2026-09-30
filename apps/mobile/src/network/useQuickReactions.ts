import { useCallback, useEffect, useRef, useState } from 'react';
import { socketManager } from './socket';

/**
 * Ephemeral quick reactions for live online matches.
 *
 * One Socket.IO event (`game:reaction`) in each direction, on the existing
 * connection: emits carry `{ gameId, reaction }`, relays arrive as
 * `{ gameId, reaction, fromUserId }`. Nothing is stored, nothing touches
 * game state, clock, rating or history — the server relays to the other
 * seats and forgets.
 *
 * Online-only by construction: the listener subscribes only while `enabled`
 * (a live online match, not replaying), and `send` no-ops otherwise. AI,
 * local, replay and analysis never even attach the listener.
 */

export type ReactionKind = 'laugh' | 'wow' | 'cry' | 'angry' | 'clap' | 'fire';

/** Flat 2D vector icons, one family (MaterialCommunityIcons, already used). */
export const REACTION_ICONS: Record<ReactionKind, string> = {
  laugh: 'emoticon-lol-outline',
  wow: 'emoticon-excited-outline',
  cry: 'emoticon-cry-outline',
  angry: 'emoticon-angry-outline',
  clap: 'hand-clap',
  fire: 'fire',
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
  enabled: boolean;
  gameId: string;
  myUserId: string | null;
}

export function useQuickReactions({ enabled, gameId, myUserId }: UseQuickReactionsOptions) {
  const [incoming, setIncoming] = useState<IncomingReaction[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    if (!enabled || !gameId) return;
    const socket = socketManager.getSocket();
    const onReaction = (p: { gameId?: string; reaction?: string; fromUserId?: string }) => {
      if (!p || p.gameId !== gameId) return;
      if (p.fromUserId && myUserId && p.fromUserId === myUserId) return;
      if (!isReactionKind(p.reaction)) return;
      idRef.current += 1;
      const item: IncomingReaction = { id: idRef.current, kind: p.reaction };
      setIncoming((prev) => [...prev.slice(-(MAX_STACK - 1)), item]);
    };
    socket.on('game:reaction', onReaction);
    return () => {
      socket.off('game:reaction', onReaction);
    };
  }, [enabled, gameId, myUserId]);

  const dismiss = useCallback((id: number) => {
    setIncoming((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const send = useCallback(
    (kind: ReactionKind) => {
      if (!enabled || !gameId) return;
      try {
        socketManager.getSocket().emit('game:reaction', { gameId, reaction: kind });
      } catch {
        // Ephemeral by design: a failed send is dropped, never retried.
      }
    },
    [enabled, gameId]
  );

  return { incoming, dismiss, send };
}
