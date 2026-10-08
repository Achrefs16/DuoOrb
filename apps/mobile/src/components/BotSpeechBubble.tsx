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
          {/* Tail pointing down at the bot's card, like a reaction bubble. */}
          <View style={[styles.tail, { borderTopColor: botColor }]} />
          <View
            style={[
              styles.tailInner,
              { borderTopColor: surface?.card ?? THEME.colors.backgroundCard },
            ]}
          />

          {botName && (
            <Text style={[styles.botLabel, { color: botColor }]} numberOfLines={1}>
              {botName}
            </Text>
          )}
          <Text style={[styles.speechText, surface && { color: surface.ink }]}>
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
    // Same overlay slot as the top reaction dock: floats over the bot's
    // card, costs zero layout, never covers the board. box-none so only
    // the bubble itself is tappable (dismiss).
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      minHeight: 52,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 200,
    },
    bubble: {
      backgroundColor: THEME.colors.backgroundCard,
      borderRadius: 14,
      borderWidth: 1.5,
      paddingVertical: 9,
      paddingHorizontal: 14,
      maxWidth: '92%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 7,
    },
    tail: {
      position: 'absolute',
      bottom: -8,
      left: 28,
      width: 0,
      height: 0,
      borderLeftWidth: 7,
      borderRightWidth: 7,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
    },
    tailInner: {
      position: 'absolute',
      bottom: -5,
      left: 29,
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 7,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
    },
    botLabel: {
      fontSize: 10,
      fontWeight: '700',
      fontFamily: THEME.fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    speechText: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: THEME.fonts.medium,
      color: THEME.colors.textPrimary,
    },
  });
