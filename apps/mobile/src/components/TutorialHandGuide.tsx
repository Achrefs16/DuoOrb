import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  Image,
} from 'react-native';

const HAND_IMAGE = require('../../assets/Pointing hand.png');

export interface GestureCoord {
  x: number;
  y: number;
}

export interface TutorialGesture {
  type: 'tap' | 'drag' | 'jump';
  from: GestureCoord;
  to?: GestureCoord;
}

interface TutorialHandGuideProps {
  gesture: TutorialGesture | null;
  visible?: boolean;
}

// Clean 3D hand dimensions (982x1480 -> 0.6635 aspect ratio)
const HAND_WIDTH = 56;
const HAND_HEIGHT = Math.round(HAND_WIDTH / 0.6635); // ~84px

// Exact fingertip offset in the cleaned asset (x: 12.01%, y: 1.69%)
const FINGERTIP_OFFSET_X = HAND_WIDTH * 0.1201; // ~6.7px
const FINGERTIP_OFFSET_Y = HAND_HEIGHT * 0.0169; // ~1.4px

export const TutorialHandGuide: React.FC<TutorialHandGuideProps> = ({
  gesture,
  visible = true,
}) => {
  const animProgress = useRef(new Animated.Value(0)).current;
  const animScale = useRef(new Animated.Value(1)).current;
  const animOpacity = useRef(new Animated.Value(0)).current;
  const animRippleScale = useRef(new Animated.Value(0)).current;
  const animRippleOpacity = useRef(new Animated.Value(0)).current;
  const animArcY = useRef(new Animated.Value(0)).current;

  const loopAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loopAnimRef.current) {
      loopAnimRef.current.stop();
      loopAnimRef.current = null;
    }

    if (!gesture || !visible) {
      animOpacity.setValue(0);
      return;
    }

    const { type, to } = gesture;

    // Reset initial animation values to zero
    animProgress.setValue(0);
    animScale.setValue(1);
    animArcY.setValue(0);
    animRippleScale.setValue(0);
    animRippleOpacity.setValue(0);
    animOpacity.setValue(0);

    if (type === 'tap') {
      const sequence = Animated.sequence([
        Animated.timing(animProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        // Slight bob up before press
        Animated.timing(animArcY, {
          toValue: -8,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        // Press down
        Animated.parallel([
          Animated.timing(animArcY, {
            toValue: 0,
            duration: 160,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(animScale, {
            toValue: 0.88,
            duration: 160,
            useNativeDriver: true,
          }),
        ]),
        // Tap ripple burst
        Animated.parallel([
          Animated.sequence([
            Animated.timing(animRippleOpacity, {
              toValue: 0.75,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(animRippleOpacity, {
              toValue: 0,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animRippleScale, {
            toValue: 1.8,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(animScale, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(animRippleScale, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(animOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.delay(200),
      ]);

      const loop = Animated.loop(sequence);
      loopAnimRef.current = loop;
      loop.start();
    } else if (type === 'drag' && to) {
      // DRAG GESTURE:
      // Guaranteed to start at progress 0 (Tray piece) -> press -> smooth glide to progress 1 (Wall slot) -> drop -> fade -> loop
      const sequence = Animated.sequence([
        // Step 1: Ensure progress is 0 while invisible
        Animated.parallel([
          Animated.timing(animProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(animOpacity, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(animScale, { toValue: 1, duration: 1, useNativeDriver: true }),
          Animated.timing(animRippleScale, { toValue: 0, duration: 1, useNativeDriver: true }),
        ]),
        // Step 2: Fade in at source (WallTray)
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(100),
        // Step 3: Finger presses down on the wall piece in tray
        Animated.timing(animScale, {
          toValue: 0.86,
          duration: 200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(120),
        // Step 4: Smooth glide upward from WallTray into target slot
        Animated.timing(animProgress, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        // Step 5: Drop at destination slot with subtle ripple
        Animated.parallel([
          Animated.timing(animScale, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(animRippleOpacity, {
              toValue: 0.75,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(animRippleOpacity, {
              toValue: 0,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animRippleScale, {
            toValue: 1.8,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(750),
        // Step 6: Fade out at destination
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        // Reset while invisible
        Animated.timing(animProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(200),
      ]);

      const loop = Animated.loop(sequence);
      loopAnimRef.current = loop;
      loop.start();
    } else if (type === 'jump' && to) {
      // JUMP GESTURE:
      // Taps orb -> leaps in an arc over opponent -> lands on goal cell
      const sequence = Animated.sequence([
        Animated.parallel([
          Animated.timing(animProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(animOpacity, { toValue: 0, duration: 1, useNativeDriver: true }),
          Animated.timing(animScale, { toValue: 1, duration: 1, useNativeDriver: true }),
        ]),
        Animated.timing(animOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        // Tap on player orb
        Animated.timing(animScale, {
          toValue: 0.86,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(180),
        // Jump arc
        Animated.parallel([
          Animated.timing(animProgress, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          // Arc up then down
          Animated.sequence([
            Animated.timing(animArcY, {
              toValue: -34,
              duration: 375,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(animArcY, {
              toValue: 0,
              duration: 375,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(animScale, {
              toValue: 1.15,
              duration: 375,
              useNativeDriver: true,
            }),
            Animated.timing(animScale, {
              toValue: 0.9,
              duration: 375,
              useNativeDriver: true,
            }),
          ]),
        ]),
        // Land at destination with ripple
        Animated.parallel([
          Animated.timing(animScale, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(animRippleOpacity, {
              toValue: 0.75,
              duration: 80,
              useNativeDriver: true,
            }),
            Animated.timing(animRippleOpacity, {
              toValue: 0,
              duration: 320,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(animRippleScale, {
            toValue: 1.9,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(800),
        // Fade out before loop
        Animated.timing(animOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(animProgress, { toValue: 0, duration: 1, useNativeDriver: true }),
        Animated.delay(200),
      ]);

      const loop = Animated.loop(sequence);
      loopAnimRef.current = loop;
      loop.start();
    }

    return () => {
      if (loopAnimRef.current) {
        loopAnimRef.current.stop();
        loopAnimRef.current = null;
      }
    };
  }, [gesture, visible]);

  if (!gesture || !visible) return null;

  const startX = gesture.from.x - FINGERTIP_OFFSET_X;
  const startY = gesture.from.y - FINGERTIP_OFFSET_Y;

  const endX = (gesture.to ? gesture.to.x : gesture.from.x) - FINGERTIP_OFFSET_X;
  const endY = (gesture.to ? gesture.to.y : gesture.from.y) - FINGERTIP_OFFSET_Y;

  const currentX = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startX, endX],
  });

  const currentY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [startY, endY],
  });

  // Ripple always anchors under the fingertip
  const rippleTargetX = gesture.type === 'drag' && gesture.to ? gesture.to.x : gesture.from.x;
  const rippleTargetY = gesture.type === 'drag' && gesture.to ? gesture.to.y : gesture.from.y;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Ripple ring under target */}
      <Animated.View
        style={[
          styles.ripple,
          {
            left: rippleTargetX,
            top: rippleTargetY,
            opacity: animRippleOpacity,
            transform: [{ scale: animRippleScale }],
          },
        ]}
      />

      {/* Pointing Hand Graphic — pure image, completely transparent background, no box shadow */}
      <Animated.View
        style={[
          styles.handContainer,
          {
            opacity: animOpacity,
            transform: [
              { translateX: currentX },
              { translateY: Animated.add(currentY, animArcY) },
              { scale: animScale },
            ],
          },
        ]}
      >
        <Image
          source={HAND_IMAGE}
          style={styles.handImage}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  handContainer: {
    position: 'absolute',
    width: HAND_WIDTH,
    height: HAND_HEIGHT,
    zIndex: 9999,
  },
  handImage: {
    width: '100%',
    height: '100%',
  },
  ripple: {
    position: 'absolute',
    width: 32,
    height: 32,
    marginLeft: -16,
    marginTop: -16,
    borderRadius: 16,
    backgroundColor: 'rgba(105, 179, 66, 0.40)',
    borderWidth: 2,
    borderColor: '#69B342',
    zIndex: 9998,
  },
});
