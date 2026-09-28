import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { THEME } from '../theme';
import { DuoOrbLogo } from '../components/DuoOrbLogo';

/** Minimum time the mark stays up. Kept short and fixed — no spinner. */
export const SPLASH_MIN_MS = 1500;

/**
 * Launch splash. Shown on every cold start, and also covers font loading and
 * identity hydration so there is never a blank white frame.
 *
 * Entrance is a small fade plus a slight scale-up. No spinner, no
 * navigation, nothing tappable. The screen does not own the transition: the
 * app unmounts it once fonts, identity, the onboarding check and this
 * minimum duration are all satisfied.
 */
export const SplashScreen: React.FC = () => {
  // Animated.Values live in state, not refs: reading a ref during render
  // breaks memoisation and trips react-hooks/refs.
  const [fade] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [fade, scale]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.center, { opacity: fade, transform: [{ scale }] }]}
      >
        <DuoOrbLogo size={104} />
        <Text style={styles.wordmark}>DuoOrb</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  wordmark: {
    marginTop: 22,
    fontFamily: THEME.fonts.extraBold,
    fontSize: 30,
    letterSpacing: -0.5,
    color: THEME.colors.textPrimary,
  },
});
