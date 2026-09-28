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

/**
 * Deliberately MUTED.
 *
 * The first pass used the full-strength brand hues at 0.62-0.9 opacity, which
 * produced a saturated rainbow strip rather than an ambient field: the glass
 * bar sat on top of near-primary blue/coral/green, so the bar read as
 * multicoloured plastic and the "10% white" tint did nothing for legibility.
 *
 * Two changes fixed it. Opacity is now 0.16-0.24, so the mesh is a whisper of
 * colour — enough to see that something is behind the glass, not enough to
 * compete with the icons. And the hues are blended toward the app background
 * first (see `tint()`), because a pure #2563EB at low opacity over #FAF8FF
 * still reads as blue; the mixed version reads as a cool neutral wash.
 */
const BLOBS = [
  { id: 'b1', cx: '16%', cy: '6%', r: '64%', color: '#2563EB', opacity: 0.24 },
  { id: 'b2', cx: '80%', cy: '0%', r: '58%', color: '#E5484D', opacity: 0.18 },
  { id: 'b3', cx: '50%', cy: '98%', r: '68%', color: '#0E9F6E', opacity: 0.2 },
  { id: 'b4', cx: '97%', cy: '76%', r: '52%', color: '#D9930D', opacity: 0.16 },
];

/**
 * Mixes a brand hue toward the app background, keeping only `amount` of its
 * chroma. This is what turns four competing colours into one coherent tint.
 */
function tint(hex: string, background: string, amount: number): string {
  const parse = (c: string) => parseInt(c.slice(1), 16);
  const a = parse(hex);
  const b = parse(background);
  const ch = (shift: number) => {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    return Math.round(cb + (ca - cb) * amount);
  };
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to2(ch(16))}${to2(ch(8))}${to2(ch(0))}`;
}

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
              <Stop offset="0" stopColor={tint(b.color, fadeToAppBackground, 0.5)} stopOpacity={b.opacity} />
              <Stop offset="0.55" stopColor={tint(b.color, fadeToAppBackground, 0.5)} stopOpacity={b.opacity * 0.45} />
              <Stop offset="1" stopColor={tint(b.color, fadeToAppBackground, 0.5)} stopOpacity="0" />
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
