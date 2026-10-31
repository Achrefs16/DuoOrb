import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { SmoothStar } from './SmoothStar';

interface FallingStarsFeedbackProps {
  /** The 0-based index of the star that was just lost (2 = 3rd star, 1 = 2nd star), or null if none */
  lostStarIndex: 2 | 1 | null;
  /** Incrementing key to trigger the animation */
  triggerKey: number;
}

/**
 * Pure floating star loss feedback (no background, no text toast).
 *
 * Displays the 3 stars floating above the board:
 * The star being lost tumbles downward with gravity, shrinks, and fades away,
 * while the remaining stars pulse gently. Fades out automatically.
 */
export const FallingStarsFeedback: React.FC<FallingStarsFeedbackProps> = ({
  lostStarIndex,
  triggerKey,
}) => {
  const [active, setActive] = useState(false);
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const containerTranslateY = useRef(new Animated.Value(20)).current;
  const fallingTranslateY = useRef(new Animated.Value(0)).current;
  const fallingRotate = useRef(new Animated.Value(0)).current;
  const fallingScale = useRef(new Animated.Value(1)).current;
  const fallingOpacity = useRef(new Animated.Value(1)).current;
  const remainingScale = useRef(new Animated.Value(1)).current;

  const useNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!triggerKey || lostStarIndex === null) return;

    // Reset values
    setActive(true);
    containerOpacity.setValue(0);
    containerTranslateY.setValue(20);
    fallingTranslateY.setValue(0);
    fallingRotate.setValue(0);
    fallingScale.setValue(1);
    fallingOpacity.setValue(1);
    remainingScale.setValue(1);

    // 1. Float in smoothly from bottom and fade in
    Animated.sequence([
      Animated.parallel([
        Animated.timing(containerOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: useNative,
        }),
        Animated.timing(containerTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: useNative,
        }),
      ]),
      // Hold briefly so the user sees the initial stars
      Animated.delay(200),
      // 2. The lost star falls down, shrinks, rotates, and dissolves
      Animated.parallel([
        Animated.timing(fallingTranslateY, {
          toValue: 36,
          duration: 650,
          easing: Easing.in(Easing.quad),
          useNativeDriver: useNative,
        }),
        Animated.timing(fallingRotate, {
          toValue: 1,
          duration: 650,
          easing: Easing.ease,
          useNativeDriver: useNative,
        }),
        Animated.timing(fallingScale, {
          toValue: 0.3,
          duration: 650,
          useNativeDriver: useNative,
        }),
        Animated.timing(fallingOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: useNative,
        }),
        // Remaining stars pulse softly with reward feel
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(remainingScale, {
            toValue: 1.18,
            duration: 180,
            useNativeDriver: useNative,
          }),
          Animated.timing(remainingScale, {
            toValue: 1,
            duration: 180,
            useNativeDriver: useNative,
          }),
        ]),
      ]),
      // Hold the result
      Animated.delay(450),
      // 3. Clean fade out
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: useNative,
      }),
    ]).start(() => {
      setActive(false);
    });
  }, [triggerKey, lostStarIndex, useNative]);

  if (!active || lostStarIndex === null) return null;

  const spin = fallingRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '38deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingContainer,
        {
          opacity: containerOpacity,
          transform: [{ translateY: containerTranslateY }],
        },
      ]}
    >
      <View style={styles.starsRow}>
        {/* Star 1: Stays alive */}
        <Animated.View style={{ transform: [{ scale: remainingScale }] }}>
          <SmoothStar size={26} color="#F59E0B" />
        </Animated.View>

        {/* Star 2: Falls if lostStarIndex === 1, otherwise stays alive */}
        {lostStarIndex === 1 ? (
          <Animated.View
            style={{
              transform: [
                { translateY: fallingTranslateY },
                { scale: fallingScale },
                { rotate: spin },
              ],
              opacity: fallingOpacity,
            }}
          >
            <SmoothStar size={26} color="#F59E0B" />
          </Animated.View>
        ) : (
          <Animated.View style={{ transform: [{ scale: remainingScale }] }}>
            <SmoothStar size={26} color="#F59E0B" />
          </Animated.View>
        )}

        {/* Star 3: Falls if lostStarIndex === 2, otherwise already absent */}
        {lostStarIndex === 2 && (
          <Animated.View
            style={{
              transform: [
                { translateY: fallingTranslateY },
                { scale: fallingScale },
                { rotate: spin },
              ],
              opacity: fallingOpacity,
            }}
          >
            <SmoothStar size={26} color="#F59E0B" />
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 165,
    alignSelf: 'center',
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    // Zero background box or border
    backgroundColor: 'transparent',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

