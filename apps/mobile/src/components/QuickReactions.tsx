import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme';
import {
  REACTION_EMOJI,
  REACTION_ORDER,
  reactionLabel,
  type IncomingReaction,
  type ReactionKind,
} from '../network/useQuickReactions';

/**
 * Quick-reaction UI: two pieces.
 *
 * `ReactionDock` is a floating bubble area — absolutely positioned, so it
 * costs zero layout and the board never moves. `side="bottom"` floats over the
 * wall inventory (your own taps); `side="top"` floats over the opponent card
 * (their taps and the engine's banter). Bubbles drop or rise into place, hold
 * briefly, fade, and remove themselves. Never a toast, never needs dismissal.
 *
 * `ReactionTray` is the sending card above Resign: six emoji buttons, no
 * labels, no gradients.
 */

/** Which side a bubble belongs to: `bottom` = yours, `top` = theirs. */
type DockSide = 'top' | 'bottom';

const ENTER_MS = 180;
const HOLD_MS = 1000;
const EXIT_MS = 260;

const ReactionBubble: React.FC<{ kind: ReactionKind; side: DockSide; onDone: () => void }> = memo(
  function ReactionBubble({ kind, side, onDone }) {
    const scale = useRef(new Animated.Value(0.6)).current;
    // Your bubbles rise out of the inventory; theirs drop in over their card.
    const dy = useRef(new Animated.Value(side === 'top' ? -10 : 10)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const doneRef = useRef(onDone);
    doneRef.current = onDone;

    useEffect(() => {
      const sequence = Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
          Animated.timing(dy, { toValue: 0, duration: ENTER_MS, useNativeDriver: true }),
        ]),
        Animated.delay(HOLD_MS),
        Animated.parallel([
          Animated.timing(dy, { toValue: -8, duration: EXIT_MS, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
        ]),
      ]);
      const sub = sequence.start(({ finished }) => {
        if (finished) doneRef.current();
      });
      return () => {
        sequence.stop();
        void sub;
      };
    }, [scale, dy, opacity]);

    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.bubbleWrap, { transform: [{ scale }, { translateY: dy }], opacity }]}
        accessibilityLabel={`${side === 'top' ? 'Opponent' : 'You'} reacted ${reactionLabel(kind)}`}
      >
        <View style={styles.bubble}>
          <Text style={styles.bubbleEmoji}>{REACTION_EMOJI[kind]}</Text>
          {/* Tail pointing back at the card the bubble belongs to. */}
          <View style={side === 'top' ? styles.bubbleTailUp : styles.bubbleTailDown} />
        </View>
      </Animated.View>
    );
  }
);
ReactionBubble.displayName = 'ReactionBubble';

export const ReactionDock: React.FC<{
  items: IncomingReaction[];
  side: DockSide;
  onDone: (id: number) => void;
}> = memo(function ReactionDock({ items, side, onDone }) {
  // Overlay, never layout: zero room, so the board never moves when one lands.
  if (items.length === 0) return null;
  return (
    <View
      style={[styles.dock, side === 'top' ? styles.dockTop : styles.dockBottom]}
      pointerEvents="none"
      accessibilityLabel={side === 'top' ? 'Opponent reactions' : 'Your reactions'}
    >
      <View style={styles.dockRow} pointerEvents="none">
        {items.map((item) => (
          <ReactionBubble key={item.id} kind={item.kind} side={side} onDone={() => onDone(item.id)} />
        ))}
      </View>
    </View>
  );
});

export const ReactionTray: React.FC<{ onSend: (kind: ReactionKind) => void }> = memo(
  function ReactionTray({ onSend }) {
    return (
      <View style={styles.trayCard} accessibilityLabel="Quick reactions">
        {REACTION_ORDER.map((kind) => (
          <TouchableOpacity
            key={kind}
            style={styles.trayBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => onSend(kind)}
            accessibilityRole="button"
            accessibilityLabel={`Send ${reactionLabel(kind)} reaction`}
          >
            <Text style={styles.trayEmoji}>{REACTION_EMOJI[kind]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  // Floating over a card: absolute, so a bubble never takes layout room and
  // never covers the board.
  dock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  // Over the wall inventory: your own reactions, rising from the tray.
  dockBottom: {},
  // Over the opponent card: their reactions, dropping in.
  dockTop: {},
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bubbleWrap: {
    paddingBottom: 4,
  },
  // White speech pill: emoji, hairline border, tail at the inventory side.
  // Roomy enough that the enlarged emoji glyph is never clipped.
  bubble: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...THEME.shadows.card,
  },
  bubbleEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  // Tail pointing down at the inventory your bubble rose from.
  bubbleTailDown: {
    position: 'absolute',
    bottom: -4,
    left: 12,
    width: 8,
    height: 8,
    backgroundColor: THEME.colors.backgroundCard,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    transform: [{ rotate: '45deg' }],
  },
  // Tail pointing up, away from the card their bubble sits on.
  bubbleTailUp: {
    position: 'absolute',
    top: -4,
    left: 12,
    width: 8,
    height: 8,
    backgroundColor: THEME.colors.backgroundCard,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    transform: [{ rotate: '45deg' }],
  },
  // Sending card: one rounded card, six square buttons, emoji only.
  trayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    borderRadius: THEME.radius.lg,
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...THEME.shadows.card,
  },
  trayBtn: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trayEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
});