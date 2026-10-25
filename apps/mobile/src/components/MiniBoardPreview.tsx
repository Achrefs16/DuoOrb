import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { THEME, useStyles } from '../theme';

export type MiniBoardPreset =
  | 'online1v1'
  | 'botMatch'
  | 'friendsRoom'
  | 'local4p'
  | 'historyReview';

interface MiniBoardPreviewProps {
  preset: MiniBoardPreset;
  size?: number;
}

interface WallSpec {
  orientation: 'h' | 'v';
  row: number; // 0..7
  col: number; // 0..7
}

interface PlayerSpec {
  id: 1 | 2 | 3 | 4;
  row: number; // 0..8
  col: number; // 0..8
}

const PRESET_CONFIGS: Record<
  MiniBoardPreset,
  {
    players: PlayerSpec[];
    walls: WallSpec[];
    highlightGoal?: { row: number; col: number };
  }
> = {
  online1v1: {
    players: [
      { id: 1, row: 6, col: 4 },
      { id: 2, row: 2, col: 4 },
    ],
    walls: [
      { orientation: 'h', row: 3, col: 3 },
      { orientation: 'v', row: 4, col: 5 },
    ],
  },
  botMatch: {
    players: [
      { id: 1, row: 7, col: 3 },
      { id: 2, row: 1, col: 5 },
    ],
    walls: [
      { orientation: 'h', row: 4, col: 4 },
      { orientation: 'v', row: 2, col: 3 },
      { orientation: 'h', row: 6, col: 1 },
    ],
  },
  friendsRoom: {
    players: [
      { id: 1, row: 5, col: 2 },
      { id: 2, row: 3, col: 6 },
    ],
    walls: [
      { orientation: 'h', row: 4, col: 2 },
      { orientation: 'v', row: 3, col: 4 },
    ],
  },
  local4p: {
    players: [
      { id: 1, row: 7, col: 4 },
      { id: 2, row: 1, col: 4 },
      { id: 3, row: 4, col: 1 },
      { id: 4, row: 4, col: 7 },
    ],
    walls: [
      { orientation: 'h', row: 3, col: 3 },
      { orientation: 'v', row: 4, col: 5 },
      { orientation: 'h', row: 5, col: 1 },
    ],
  },
  historyReview: {
    players: [
      { id: 1, row: 0, col: 4 }, // Reached opponent home line
      { id: 2, row: 4, col: 5 },
    ],
    walls: [
      { orientation: 'h', row: 2, col: 4 },
      { orientation: 'v', row: 5, col: 3 },
    ],
    highlightGoal: { row: 0, col: 4 },
  },
};

export const MiniBoardPreview: React.FC<MiniBoardPreviewProps> = ({
  preset,
  size = 112,
}) => {
  const styles = useStyles(createStyles);
  const cfg = PRESET_CONFIGS[preset];

  const padding = 5;
  const boardArea = size - padding * 2;
  const gap = 1.4;
  const cellSize = (boardArea - 8 * gap) / 9;
  const orbRadius = cellSize * 0.38;
  const wallThickness = 3.6;

  // Render 9x9 cells
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const x = padding + c * (cellSize + gap);
      const y = padding + r * (cellSize + gap);
      const isAlt = (r + c) % 2 === 1;
      const isGoal =
        cfg.highlightGoal &&
        cfg.highlightGoal.row === r &&
        cfg.highlightGoal.col === c;

      cells.push(
        <Rect
          key={`c-${r}-${c}`}
          x={x}
          y={y}
          width={cellSize}
          height={cellSize}
          rx={2}
          fill={isGoal ? '#FEF08A' : isAlt ? '#EDEBE5' : '#F7F6F2'}
          stroke={isGoal ? '#EAB308' : '#DFDDD5'}
          strokeWidth={isGoal ? 1.2 : 0.4}
        />
      );
    }
  }

  // Render walls
  const walls = cfg.walls.map((w, idx) => {
    if (w.orientation === 'h') {
      const wx = padding + w.col * (cellSize + gap);
      const wy = padding + (w.row + 1) * (cellSize + gap) - gap / 2 - wallThickness / 2;
      const wWidth = 2 * cellSize + gap;
      return (
        <Rect
          key={`wall-h-${idx}`}
          x={wx}
          y={wy}
          width={wWidth}
          height={wallThickness}
          rx={1.5}
          fill="#8A8474"
          stroke="#5C5648"
          strokeWidth={0.5}
        />
      );
    } else {
      const wx = padding + (w.col + 1) * (cellSize + gap) - gap / 2 - wallThickness / 2;
      const wy = padding + w.row * (cellSize + gap);
      const wHeight = 2 * cellSize + gap;
      return (
        <Rect
          key={`wall-v-${idx}`}
          x={wx}
          y={wy}
          width={wallThickness}
          height={wHeight}
          rx={1.5}
          fill="#8A8474"
          stroke="#5C5648"
          strokeWidth={0.5}
        />
      );
    }
  });

  // Render orbs
  const orbs = cfg.players.map((p) => {
    const cx = padding + p.col * (cellSize + gap) + cellSize / 2;
    const cy = padding + p.row * (cellSize + gap) + cellSize / 2;
    const gradId = `orbGrad-${preset}-${p.id}`;

    return (
      <React.Fragment key={`orb-${p.id}`}>
        {/* Subtle drop shadow under orb */}
        <Circle cx={cx} cy={cy + 0.8} r={orbRadius} fill="rgba(0,0,0,0.18)" />
        {/* Shaded orb sphere */}
        <Circle cx={cx} cy={cy} r={orbRadius} fill={`url(#${gradId})`} />
        {/* Specular glossy highlight */}
        <Circle
          cx={cx - orbRadius * 0.3}
          cy={cy - orbRadius * 0.3}
          r={orbRadius * 0.28}
          fill="rgba(255, 255, 255, 0.65)"
        />
      </React.Fragment>
    );
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Board frame gradient */}
          <LinearGradient id="boardFrameGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#DFDDD5" />
            <Stop offset="100%" stopColor="#D0CEC4" />
          </LinearGradient>

          {/* Player 1 (Tactical Blue) */}
          <RadialGradient id={`orbGrad-${preset}-1`} cx="35%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#93C5FD" />
            <Stop offset="45%" stopColor="#3B82F6" />
            <Stop offset="100%" stopColor="#1D4ED8" />
          </RadialGradient>

          {/* Player 2 (Coral / Red) */}
          <RadialGradient id={`orbGrad-${preset}-2`} cx="35%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#FCA5A5" />
            <Stop offset="45%" stopColor="#E5484D" />
            <Stop offset="100%" stopColor="#991B1B" />
          </RadialGradient>

          {/* Player 3 (Green) */}
          <RadialGradient id={`orbGrad-${preset}-3`} cx="35%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#86EFAC" />
            <Stop offset="45%" stopColor="#0E9F6E" />
            <Stop offset="100%" stopColor="#065F46" />
          </RadialGradient>

          {/* Player 4 (Amber) */}
          <RadialGradient id={`orbGrad-${preset}-4`} cx="35%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#FDE68A" />
            <Stop offset="45%" stopColor="#D9930D" />
            <Stop offset="100%" stopColor="#92400E" />
          </RadialGradient>
        </Defs>

        {/* Board base container with bevel */}
        <Rect
          x={0}
          y={0}
          width={size}
          height={size}
          rx={10}
          fill="url(#boardFrameGrad)"
          stroke="#C5C3B9"
          strokeWidth={1}
        />
        <Rect
          x={2}
          y={2}
          width={size - 4}
          height={size - 4}
          rx={8}
          fill="#E8E6DF"
        />

        {/* Board Cells */}
        {cells}

        {/* Walls */}
        {walls}

        {/* Player Orbs */}
        {orbs}

        {/* Optional Star Badge for History Review */}
        {cfg.highlightGoal && (
          <SvgText
            x={padding + cfg.highlightGoal.col * (cellSize + gap) + cellSize / 2}
            y={padding + cfg.highlightGoal.row * (cellSize + gap) + cellSize / 2 + 3}
            fontSize={cellSize * 0.75}
            textAnchor="middle"
            fill="#B45309"
            fontWeight="bold"
          >
            ★
          </SvgText>
        )}
      </Svg>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
