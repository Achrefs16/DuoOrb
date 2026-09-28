import React, { useState } from 'react';
import { StyleSheet, Text, View, LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { THEME } from '../theme';

interface RatingPoint {
  ratingAfter: number;
  timestamp?: string | number;
}

interface RatingChartProps {
  data: RatingPoint[];
  currentRating: number;
  showHeader?: boolean;
}

export const RatingChart: React.FC<RatingChartProps> = ({ data, currentRating, showHeader = true }) => {
  const [containerWidth, setContainerWidth] = useState(320);
  const height = 110;
  const yLabelW = 34;
  const paddingX = 8;
  const paddingY = 16;

  // Use the recent 20 points
  const points = data.slice(-20);
  const ratings = points.length > 0 ? points.map((p) => p.ratingAfter) : [currentRating];

  const minVal = Math.min(...ratings) - 20;
  const maxVal = Math.max(...ratings) + 20;
  const highestVal = Math.max(...ratings);

  const range = Math.max(40, maxVal - minVal);
  const chartW = Math.max(100, containerWidth - yLabelW - paddingX * 2);
  const chartH = height - paddingY * 2;

  const yFor = (val: number) => paddingY + chartH - ((val - minVal) / range) * chartH;
  // Y axis: min / mid / max, rounded to tens.
  const yTicks = [minVal + 20, minVal + 20 + range / 2, maxVal - 20].map((v) =>
    Math.round(v / 10) * 10
  );

  const monthFmt = (ts?: string | number): string => {
    if (ts === undefined || ts === null) return '';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month: 'short' });
  };
  // X axis: first / middle / Now (Stitch style).
  const xLabels = (() => {
    if (points.length === 0) return ['Now'];
    if (points.length === 1) return [monthFmt(points[0].timestamp) || 'Now'];
    if (points.length === 2) return [monthFmt(points[0].timestamp), 'Now'];
    return [
      monthFmt(points[0].timestamp),
      monthFmt(points[Math.floor(points.length / 2)].timestamp),
      'Now',
    ];
  })();

  // Coordinates
  const coords = ratings.map((val, idx) => {
    const x =
      ratings.length > 1
        ? yLabelW + paddingX + (idx / (ratings.length - 1)) * chartW
        : yLabelW + paddingX + chartW / 2;
    const y = yFor(val);
    return { x, y, val };
  });

  // Max 5 nodes (first + last always) — the line still uses every point.
  const nodeIdx = (() => {
    if (coords.length <= 5) return coords.map((_, i) => i);
    const out: number[] = [];
    for (let k = 0; k < 5; k++) {
      out.push(Math.round((k * (coords.length - 1)) / 4));
    }
    return Array.from(new Set(out));
  })();

  // SVG Line path
  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  // Area path
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x},${height} L ${coords[0].x},${height} Z`
      : '';

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 2) {
      setContainerWidth(w);
    }
  };

  const trend = ratings.length > 1 ? ratings[ratings.length - 1] - ratings[0] : 0;

  return (
    <View style={styles.card} onLayout={onLayout}>
      {showHeader && (
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionLabel}>RATING HISTORY</Text>
          <Text style={styles.recentSummary}>
            Last {ratings.length} games ·{' '}
            <Text
              style={{
                fontFamily: THEME.fonts.bold,
                color: trend >= 0 ? THEME.colors.win : THEME.colors.loss,
                fontWeight: '700',
              }}
            >
              {trend >= 0 ? `+${trend}` : `${trend}`}
            </Text>
          </Text>
        </View>
        <View style={styles.highestBadge}>
          <Text style={styles.highestLabel}>Peak</Text>
          <Text style={styles.highestValue}>{highestVal}</Text>
        </View>
      </View>
      )}

      <View style={styles.svgWrap}>
        {/* Y axis ratings */}
        {yTicks.map((t) => (
          <Text key={t} style={[styles.yTick, { top: yFor(t) - 7 }]}>
            {t}
          </Text>
        ))}
        <Svg width={containerWidth} height={height}>
          <Defs>
            <LinearGradient id="ratingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#004AC6" stopOpacity={0.14} />
              <Stop offset="100%" stopColor="#004AC6" stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Baseline grid lines */}
          {[0.15, 0.5, 0.85].map((f) => {
            const gy = paddingY + chartH * f;
            return (
              <Line
                key={f}
                x1={yLabelW}
                x2={yLabelW + paddingX + chartW}
                y1={gy}
                y2={gy}
                stroke="#DAE2FD"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}

          {areaPath ? <Path d={areaPath} fill="url(#ratingGradient)" /> : null}
          {linePath ? (
            <Path
              d={linePath}
              stroke="#004AC6"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Nodes: white/blue, last one green (max 5) */}
          {nodeIdx.map((i) => {
            const pt = coords[i];
            const isLast = i === coords.length - 1;
            return (
              <Circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={isLast ? 4.5 : 4}
                fill={isLast ? '#007F36' : '#FFFFFF'}
                stroke={isLast ? '#FFFFFF' : '#004AC6'}
                strokeWidth={2}
              />
            );
          })}

          {/* First + last value labels */}
          {coords.length > 0 && (
            <SvgText
              x={coords[0].x + 2}
              y={coords[0].y - 4}
              fill="#131B2E"
              fontSize={10}
              fontWeight="600"
              fontFamily={THEME.fonts.semiBold}
            >
              {coords[0].val.toLocaleString('en-US')}
            </SvgText>
          )}
          {coords.length > 1 && (
            <SvgText
              x={Math.max(yLabelW, coords[coords.length - 1].x - 32)}
              y={coords[coords.length - 1].y - 2}
              fill="#007F36"
              fontSize={10}
              fontWeight="600"
              fontFamily={THEME.fonts.semiBold}
            >
              {coords[coords.length - 1].val.toLocaleString('en-US')}
            </SvgText>
          )}
        </Svg>
      </View>

      <View style={styles.footerRow}>
        {xLabels.map((l, i) => (
          <Text
            key={`${l}-${i}`}
            style={[styles.statSub, i === xLabels.length - 1 && styles.nowLabel]}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    paddingTop: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    ...THEME.shadows.card,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 1.5,
  },
  recentSummary: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  highestBadge: {
    alignItems: 'flex-end',
  },
  highestLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  highestValue: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  svgWrap: {
    marginTop: -4,
  },
  yTick: {
    position: 'absolute',
    left: 0,
    width: 30,
    textAlign: 'right',
    fontFamily: THEME.fonts.medium,
    fontSize: 9,
    fontWeight: '500',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  nowLabel: {
    color: THEME.colors.success,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 2,
  },
  statSub: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
