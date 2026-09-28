import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Vibrant mesh gradient backdrop for the floating nav bar.
 *
 * Built from four overlapping SVG radial gradients rather than an image or a
 * library: it scales to any width, costs one native view, and needs no asset
 * to keep in sync. The blobs are deliberately large and heavily overlapping so
 * the blend reads as a soft mesh rather than four distinct spots.
 *
 * Colours are the brand hues already in use (blue / coral / green / amber) so
 * the nav does not introduce a fifth palette.
 */

interface MeshGradientProps {
  /** Bar height; the gradient fills exactly this box. */
  height: number;
  /** App background the mesh fades into at the bottom edge. */
  fadeToAppBackground?: string;
}

const BLOBS = [
  { id: 'b1', cx: '18%', cy: '8%', r: '62%', color: '#2563EB', opacity: 0.9 },
  { id: 'b2', cx: '78%', cy: '0%', r: '58%', color: '#E5484D', opacity: 0.72 },
  { id: 'b3', cx: '52%', cy: '96%', r: '66%', color: '#0E9F6E', opacity: 0.78 },
  { id: 'b4', cx: '96%', cy: '74%', r: '52%', color: '#D9930D', opacity: 0.62 },
];

export const MeshGradient: React.FC<MeshGradientProps> = ({
  height,
  fadeToAppBackground = '#FAF8FF',
}) => {
  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={height}>
        <Defs>
          {BLOBS.map((b) => (
            <RadialGradient
              key={b.id}
              id={b.id}
              cx={b.cx}
              cy={b.cy}
              rx={b.r}
              ry={b.r}
              gradientUnits="objectBoundingBox"
            >
              <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
              <Stop offset="0.55" stopColor={b.color} stopOpacity={b.opacity * 0.45} />
              <Stop offset="1" stopColor={b.color} stopOpacity="0" />
            </RadialGradient>
          ))}
          {/* Vertical wash: the app background returns at the bottom edge so
              the bar never reads as a hard band against page content. */}
          <RadialGradient id="fade" cx="50%" cy="120%" rx="90%" ry="70%">
            <Stop offset="0" stopColor={fadeToAppBackground} stopOpacity="1" />
            <Stop offset="1" stopColor={fadeToAppBackground} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={fadeToAppBackground} />
        {BLOBS.map((b) => (
          <Rect key={b.id} x="0" y="0" width="100%" height={height} fill={`url(#${b.id})`} />
        ))}
        <Rect x="0" y={height * 0.35} width="100%" height={height * 0.65} fill="url(#fade)" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
});
