import React, { memo, useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';
import {
  REACTION_ICONS,
  REACTION_ORDER,
  reactionLabel,
  type IncomingReaction,
  type ReactionKind,
} from '../network/useQuickReactions';

/**
 * Quick-reaction UI: two separate areas, both online-only.
 *
 * `ReactionDock` is the reserved receiving space between the top bar and the
 * opponent card. Fixed height, visually almost empty, pointer-transparent —
 * bubbles pop in from the opponent-card direction, float up slightly, fade,
 * and remove themselves. Never toasts, never needs dismissal, never shifts
 * layout (absolute positioning inside a fixed-height dock).
 *
 * `ReactionTray` is the sending row under the Resign button: six compact
 * icon buttons, no card, no labels, no gradients.
 */

// ---------------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------------

const ENTER_MS = 220;
const HOLD_MS = 1200;
const EXIT_MS = 350;

const ReactionBubble: React.FC<{ kind: ReactionKind; onDone: () => void }> = memo(
  ({ kind, onDone }) => {
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
        style={[styles.bubble, { transform: [{ scale }, { translateY: dy }], opacity }]}
        accessibilityLabel={`Opponent reacted ${reactionLabel(kind)}`}
      >
        <MaterialCommunityIcons
          name={REACTION_ICONS[kind] as 'emoticon-lol-outline'}
          size={20}
          color={THEME.colors.textSecondaryStrong}
        />
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
      <View style={styles.tray} accessibilityLabel="Quick reactions">
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
            <MaterialCommunityIcons
              name={REACTION_ICONS[kind] as 'emoticon-lol-outline'}
              size={22}
              color={THEME.colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  // Reserved receiving space: fixed height so a bubble never shifts layout.
  // Transparent and quiet when empty — it borrows breathing room, not board.
  dock: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Small speech-bubble-like pill around the icon.
  bubble: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    ...THEME.shadows.card,
  },
  // Sending row: no card, no labels — six evenly spaced tap targets.
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingVertical: 2,
  },
  trayBtn: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
