import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface SmoothStarProps {
  size?: number;
  color: string;
  style?: ViewStyle;
}

/**
 * Perfectly smooth, rounded 5-point star geometry.
 * Uses quadratic bezier arcs on all vertices with round stroke joins,
 * completely eliminating sharp needle angles in favor of a friendly,
 * modern, polished mobile game aesthetic.
 */
const SMOOTH_STAR_PATH =
  'M 11.38 3.94 Q 12.00 2.70 12.62 3.94 L 14.03 6.74 Q 14.82 8.32 16.56 8.58 L 19.67 9.06 Q 21.04 9.26 20.05 10.24 L 17.82 12.45 Q 16.57 13.68 16.85 15.42 L 17.36 18.52 Q 17.58 19.89 16.36 19.25 L 13.56 17.81 Q 12.00 17.00 10.44 17.81 L 7.64 19.25 Q 6.42 19.89 6.64 18.52 L 7.15 15.42 Q 7.43 13.68 6.18 12.45 L 3.95 10.24 Q 2.96 9.26 4.33 9.06 L 7.44 8.58 Q 9.18 8.32 9.97 6.74 Z';

export const SmoothStar: React.FC<SmoothStarProps> = ({
  size = 16,
  color,
  style,
}) => {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Subtle drop shadow outline for crisp contrast against any avatar shirt/bg */}
        <Path
          d={SMOOTH_STAR_PATH}
          fill="rgba(0, 0, 0, 0.45)"
          stroke="rgba(0, 0, 0, 0.45)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          transform="translate(0, 1.5)"
        />
        {/* Main smooth star (optically centered at Y=12) */}
        <Path
          d={SMOOTH_STAR_PATH}
          fill={color}
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
          transform="translate(0, 0.7)"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
