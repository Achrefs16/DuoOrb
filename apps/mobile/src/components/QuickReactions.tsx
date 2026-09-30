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
 * Quick-reaction UI: two separate areas.
 *
 * `ReactionDock` is the reserved receiving space between the top bar and the
 * opponent card. Fixed, compact height, pointer-transparent — bubbles pop in
 * from the opponent-card direction with a speech tail, float up slightly,
 * fade, and remove themselves. Never a toast, never needs dismissal, never
 * shifts layout (absolute positioning inside a fixed-height dock).
 *
 * `ReactionTray` is the sending card under the Resign button: six round
 * emoji buttons on one rounded card. No labels, no gradients.
 */

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

const ENTER_MS = 220;
const HOLD_MS = 1200;
const EXIT_MS = 350;

const ReactionBubble: React.FC<{ kind: ReactionKind; onDone: () => void }> = memo(
  function ReactionBubble({ kind, onDone }) {
    const scale = useRef(new Animated.Value(0.6)).current;
    const dy = useRef(new Animated.Value(10)).current;
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
        accessibilityLabel={`Opponent reacted ${reactionLabel(kind)}`}
      >
        <View style={styles.bubble}>
          <Text style={styles.bubbleEmoji}>{REACTION_EMOJI[kind]}</Text>
          {/* Speech tail pointing down at the opponent card it came from. */}
          <View style={styles.bubbleTail} />
        </View>
      </Animated.View>
    );
  }
);
ReactionBubble.displayName = 'ReactionBubble';

export const ReactionDock: React.FC<{
  items: IncomingReaction[];
  onDone: (id: number) => void;
}> = memo(function ReactionDock({ items, onDone }) {
  return (
    <View style={styles.dock} pointerEvents="none" accessibilityLabel="Opponent reactions">
      <View style={styles.dockRow} pointerEvents="none">
        {items.map((item) => (
          <ReactionBubble key={item.id} kind={item.kind} onDone={() => onDone(item.id)} />
        ))}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

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
  // Reserved receiving space: fixed and compact so a bubble never shifts
  // layout or steals board room.
  dock: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bubbleWrap: {
    paddingBottom: 4,
  },
  // White speech pill: emoji, hairline border, tail at the opponent side.
  bubble: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...THEME.shadows.card,
  },
  bubbleEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  bubbleTail: {
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
