import React, { useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Orientation } from '@duoorb/game-core';
import { THEME, hexToRgba } from '../theme';

interface WallTrayProps {
  /** Current player's ball color — both pieces share it. */
  color: string;
  /** Walls remaining for the current player. */
  count: number;
  /** Which piece is currently being dragged. */
  held: Orientation | null;
  disabled?: boolean;
  onDragStart: (orientation: Orientation, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
}

interface PieceProps {
  orientation: Orientation;
  color: string;
  held: boolean;
  disabled?: boolean;
  barW: number;
  barH: number;
  touchW: number;
  touchH: number;
  label: string;
  onDragStart: (orientation: Orientation, pageX: number, pageY: number) => void;
  onDragMove: (pageX: number, pageY: number) => void;
  onDragEnd: (pageX: number, pageY: number) => void;
}

const WallPiece: React.FC<PieceProps> = ({
  orientation,
  color,
  held,
  disabled,
  barW,
  barH,
  touchW,
  touchH,
  label,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const cbRef = useRef({ onDragStart, onDragMove, onDragEnd });
  cbRef.current = { onDragStart, onDragMove, onDragEnd };
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          cbRef.current.onDragStart(
            orientation,
            e.nativeEvent.pageX,
            e.nativeEvent.pageY
          );
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          cbRef.current.onDragMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderRelease: (e: GestureResponderEvent) => {
          cbRef.current.onDragEnd(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderTerminate: (e: GestureResponderEvent) => {
          cbRef.current.onDragEnd(e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [orientation]
  );

  return (
    <View
      {...responder.panHandlers}
      style={[
        styles.pieceSlot,
        { width: touchW, height: touchH },
        disabled && styles.pieceDisabled,
      ]}
      accessibilityLabel={`Drag ${label.toLowerCase()} wall`}
    >
      <View
        style={[
          styles.pieceBar,
          {
            width: barW,
            height: barH,
            borderRadius: Math.min(barW, barH) / 2,
          },
          held
            ? { backgroundColor: hexToRgba(color, 0.16), elevation: 0 }
            : {
                ...THEME.shadows.wall,
                backgroundColor: color,
                shadowColor: color,
              },
        ]}
      />
      <Text style={styles.pieceLabel}>{label}</Text>
    </View>
  );
};

/**
 * Wall placement controls matching Stitch active match design:
 * Clean 3-column card:
 * [ Horizontal Wall Button ] | [ Available Wall Count ] | [ Vertical Wall Button ]
 */
export const WallTray: React.FC<WallTrayProps> = ({
  color,
  count,
  held,
  disabled,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { width: winWidth } = useWindowDimensions();
  const s = Math.max(0.8, Math.min(1, winWidth / 390));
  const inactive = disabled || count <= 0;

  const slotW = 100 * s;
  const slotH = 68 * s;

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {/* Horizontal Wall Column */}
        <WallPiece
          orientation="H"
          color={color}
          held={held === 'H'}
          disabled={inactive}
          barW={36 * s}
          barH={8 * s}
          touchW={slotW}
          touchH={slotH}
          label="Horizontal"
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        {/* Center Available Count Column */}
        <View style={[styles.countBox, { width: slotW * 0.85, height: slotH }]}>
          <Text style={styles.countNumber}>{count}</Text>
          <Text style={styles.countSub}>Available</Text>
        </View>

        {/* Vertical Wall Column */}
        <WallPiece
          orientation="V"
          color={color}
          held={held === 'V'}
          disabled={inactive}
          barW={8 * s}
          barH={20 * s}
          touchW={slotW}
          touchH={slotH}
          label="Vertical"
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    ...THEME.shadows.card,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  pieceSlot: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  pieceBar: {},
  pieceLabel: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  pieceDisabled: {
    opacity: 0.35,
  },
  countBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  countNumber: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
  countSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
});
