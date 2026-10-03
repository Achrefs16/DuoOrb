import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Bottom-sheet entrance, shared so every sheet opens identically.
 *
 * The Modal itself stays `animationType="none"` so the dim overlay appears
 * instantly — only the sheet card slides up, fast (220ms, ease-out cubic).
 * Animating the whole modal instead drags the dim background along, which
 * reads as lag rather than motion.
 */
export function useSheetSlide(visible: boolean): Animated.Value {
  // Lazy initializer (not a ref): one value per mount, no render-phase ref
  // access for the lint rule to flag.
  const [slide] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visible) return;
    slide.setValue(0);
    const anim = Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [visible, slide]);
  return slide;
}

/** TranslateY style driving the sheet card from `useSheetSlide`. */
export function sheetSlideStyle(slide: Animated.Value, distance = 48): {
  transform: { translateY: Animated.AnimatedInterpolation<number> }[];
} {
  return {
    transform: [
      {
        translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
      },
    ],
  };
}
