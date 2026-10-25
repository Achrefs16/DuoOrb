import React, { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME, useStyles } from '../theme';
import type { HudSurface } from './GameHud';

interface BotSpeechBubbleProps {
  text: string | null;
  botName?: string;
  botColor?: string;
  onDismiss?: () => void;
  /** Auto-hide timeout in milliseconds. Defaults to 4000ms. */
  durationMs?: number;
  /** Skin card takeover (bg + ink travel together). */
  surface?: HudSurface;
}

const ENTER_MS = 220;
const EXIT_MS = 200;

export const BotSpeechBubble: React.FC<BotSpeechBubbleProps> = memo(
  function BotSpeechBubble({
    text,
    botName,
    botColor = THEME.colors.primary,
    onDismiss,
    durationMs = 4000,
    surface,
  }) {
    const styles = useStyles(createStyles);
    const scale = useRef(new Animated.Value(0.7)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const dy = useRef(new Animated.Value(-12)).current;
    const dismissRef = useRef(onDismiss);
    dismissRef.current = onDismiss;

    useEffect(() => {
      if (!text) return;

      scale.setValue(0.7);
      opacity.setValue(0);
      dy.setValue(-12);

      const anim = Animated.sequence([
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            friction: 7,
            tension: 140,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: ENTER_MS,
            useNativeDriver: true,
          }),
          Animated.timing(dy, {
            toValue: 0,
            duration: ENTER_MS,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(durationMs),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: EXIT_MS,
            useNativeDriver: true,
          }),
          Animated.timing(dy, {
            toValue: -8,
            duration: EXIT_MS,
            useNativeDriver: true,
          }),
        ]),
      ]);

      const sub = anim.start(({ finished }) => {
        if (finished) {
          dismissRef.current?.();
        }
      });

      return () => {
        anim.stop();
        void sub;
      };
    }, [text, durationMs, scale, opacity, dy]);

    if (!text) return null;

    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            opacity,
            transform: [{ scale }, { translateY: dy }],
          },
        ]}
      >
        <Pressable
          onPress={() => dismissRef.current?.()}
          style={[
            styles.bubble,
            { borderColor: botColor },
            surface && { backgroundColor: surface.card },
          ]}
          accessibilityRole="text"
          accessibilityLabel={`${botName ?? 'Bot'} says: ${text}`}
        >
          {/* Tail pointing down at the bot's avatar in the strip below. */}
          <View style={[styles.tail, { borderTopColor: botColor }]} />
          <View
            style={[
              styles.tailInner,
              { borderTopColor: surface?.card ?? THEME.colors.backgroundCard },
            ]}
          />

          <Text
            style={[styles.speechText, surface && { color: surface.ink }]}
            numberOfLines={2}
          >
            {text}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }
);

BotSpeechBubble.displayName = 'BotSpeechBubble';

const createStyles = () =>
  StyleSheet.create({
    // Floats in the empty space of the 56px top header bar, above the bot's
    // HUD strip. box-none so only the bubble itself is tappable (dismiss).
    container: {
      position: 'absolute',
      top: -44,
      left: 52,
      right: 48,
      alignItems: 'flex-start',
      zIndex: 60,
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'center',
      maxWidth: '100%',
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(0, 0, 0, 0.08)',
      backgroundColor: '#FFFFFF',
    },
    tail: {
      position: 'absolute',
      bottom: -7,
      left: 24,
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#E2E8F0',
    },
    tailInner: {
      position: 'absolute',
      bottom: -5,
      left: 25,
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: '#FFFFFF',
    },
    speechText: {
      fontSize: 11.5,
      lineHeight: 15,
      fontFamily: THEME.fonts.semiBold,
      fontWeight: '600',
      color: '#161512',
    },
  });
