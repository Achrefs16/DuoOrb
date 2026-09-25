import React from 'react';
import { StyleSheet, View } from 'react-native';
import { THEME } from '../theme';

interface DuoOrbLogoProps {
  size?: number;
}

/**
 * The DuoOrb mark: a blue orb and a red orb pressed against each other.
 *
 * Two filled circles with no stroke — a stroked circle rasterises unevenly at
 * fractional sizes, which is the same class of bug the board turn ring had.
 * Depth comes from a soft shadow plus an offset highlight instead, so the
 * mark stays crisp at any size.
 */
export const DuoOrbLogo: React.FC<DuoOrbLogoProps> = ({ size = 96 }) => {
  const orb = size * 0.58;
  // The orbs overlap so they read as pushing rather than sitting side by
  // side. Sized so the pair spans exactly `size`: 2 * 0.58 - 0.16 = 1.
  const overlap = size * 0.16;
  const highlight = orb * 0.3;

  const renderOrb = (color: string, key: string) => (
    <View
      key={key}
      style={[
        styles.orb,
        {
          width: orb,
          height: orb,
          borderRadius: orb / 2,
          backgroundColor: color,
          shadowColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.highlight,
          {
            width: highlight,
            height: highlight,
            borderRadius: highlight / 2,
            top: orb * 0.16,
            left: orb * 0.2,
          },
        ]}
      />
    </View>
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={{ flexDirection: 'row', marginLeft: -overlap }}>
        {renderOrb(THEME.colors.player1, 'blue')}
        {renderOrb(THEME.colors.player2, 'red')}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
});
