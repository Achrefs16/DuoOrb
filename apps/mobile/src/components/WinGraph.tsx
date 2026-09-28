import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Circle, Line, Polyline, Svg } from 'react-native-svg';
import { THEME } from '../theme';

interface WinGraphProps {
  /** Win chance 0..1 per step, including step 0. */
  points: number[];
  /** Current step index into points. */
  current: number;
  /** Move numbers (1-based steps) to mark as turning points. */
  moments?: number[];
}

/** Tiny win-chance curve with a current-step marker. Calm by design. */
export const WinGraph: React.FC<WinGraphProps> = ({
  points,
  current,
  moments = [],
}) => {
  const W = 300;
  const H = 56;
  const PAD = 4;
  if (points.length < 2) return null;

  const x = (i: number) =>
    PAD + (i / Math.max(1, points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - Math.max(0, Math.min(1, v)) * (H - PAD * 2);
  const line = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const cx = x(Math.max(0, Math.min(points.length - 1, current)));
  const cy = y(points[Math.max(0, Math.min(points.length - 1, current))] ?? 0.5);

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
        <Line
          x1={0}
          y1={y(0.5)}
          x2={W}
          y2={y(0.5)}
          stroke={THEME.colors.boardBorder}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <Polyline
          points={line}
          fill="none"
          stroke="#0D9488"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {moments.map((m) => {
          const i = Math.max(0, Math.min(points.length - 1, m));
          return (
            <Circle
              key={`m-${m}`}
              cx={x(i)}
              cy={y(points[i] ?? 0.5)}
              r={3}
              fill="#D97706"
            />
          );
        })}
        <Line
          x1={cx}
          y1={0}
          x2={cx}
          y2={H}
          stroke={THEME.colors.textPrimary}
          strokeWidth={1.5}
        />
        <Circle cx={cx} cy={cy} r={3.5} fill={THEME.colors.textPrimary} />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 4,
  },
});
