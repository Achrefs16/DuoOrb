import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface DuoOrbLogoProps {
  size?: number;
  /**
   * Extra transparent breathing room around the mark, as a fraction of `size`.
   * The source asset is a rounded-square app icon, so on a plain background it
   * reads best with a little padding rather than edge to edge.
   */
  inset?: number;
}

/**
 * The DuoOrb mark: a blue orb and a red orb inside a soft rounded tile.
 *
 * Uses the real brand asset rather than drawn circles — it carries the
 * gradients, highlights and orbit arcs that make the mark recognisable, and it
 * is the same file that ships as the app icon.
 */
export const DuoOrbLogo: React.FC<DuoOrbLogoProps> = ({ size = 96, inset = 0 }) => {
  const box = size * (1 - inset * 2);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={require('../../assets/duoorb-mark.png')}
        style={{ width: box, height: box }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="DuoOrb"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
