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
import { BoardPalette, useBoardPalette } from '../theme/boardTheme';

interface WallTrayProps {
  /** Current player's ball color — both pieces share it. */
  color: string;
  /** Walls remaining for the current player. */
  count: number;
  /** Which piece is currently being dragged (logical orientation). */
  held: Orientation | null;
  disabled?: boolean;
  /**
   * Render pieces swapped to match a 90°/270° board rotation. The drag value
   * stays logical ('H' means game-H all the way to the server) — only the
   * drawn shape and label follow what that wall looks like on the rotated
   * board. Without this, the tray shows a screen-horizontal piece whose ghost
   * and placed wall render screen-vertical, i.e. picking "horizontal" appears
   * to produce a vertical wall.
   */
  swapVisuals?: boolean;
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
  // Same palette as the board (P5.1): the tray is board chrome, not menu UI.
  const trayPalette = useBoardPalette();
  const styles = useMemo(() => getTrayStyles(trayPalette), [trayPalette]);

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
  swapVisuals = false,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const { width: winWidth } = useWindowDimensions();
  const s = Math.max(0.8, Math.min(1, winWidth / 390));
  const inactive = disabled || count <= 0;
  const trayPalette = useBoardPalette();
  const styles = useMemo(() => getTrayStyles(trayPalette), [trayPalette]);

  const slotW = 100 * s;
  // Player-card height: avatar 36 + card padding 2×10 ≈ 56. The tray matches
  // it (40 + card padding 2×8) so the inventory costs no extra vertical room.
  const slotH = 40 * s;

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {/* Horizontal Wall Column */}
        <WallPiece
          orientation="H"
          color={color}
          held={held === 'H'}
          disabled={inactive}
          barW={(swapVisuals ? 7 : 30) * s}
          barH={(swapVisuals ? 16 : 7) * s}
          touchW={slotW}
          touchH={slotH}
          label={swapVisuals ? 'Vertical' : 'Horizontal'}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        {/* Center Count Column: the number only, no caption. */}
        <View style={[styles.countBox, { width: slotW * 0.85, height: slotH }]}>
          <Text style={styles.countNumber}>{count}</Text>
        </View>

        {/* Vertical Wall Column */}
        <WallPiece
          orientation="V"
          color={color}
          held={held === 'V'}
          disabled={inactive}
          barW={(swapVisuals ? 30 : 7) * s}
          barH={(swapVisuals ? 7 : 16) * s}
          touchW={slotW}
          touchH={slotH}
          label={swapVisuals ? 'Horizontal' : 'Vertical'}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      </View>
    </View>
  );
};

// Tray styles parameterized by board palette (P5.1): layout/geometry stay
// global, only the surface tokens follow the active board theme.
const getTrayStyles = (p: BoardPalette) =>
  StyleSheet.create({
  card: {
    backgroundColor: p.trayCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: p.trayHairline,
    padding: 8,
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
    backgroundColor: p.trayCard,
    borderWidth: 1,
    borderColor: p.boardBorder,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 3,
  },
  pieceBar: {},
  pieceDisabled: {
    opacity: 0.35,
  },
  countBox: {
    backgroundColor: p.trayPill,
    borderWidth: 1,
    borderColor: p.trayHairline,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
  },
  countNumber: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 15,
    fontWeight: '800',
    color: p.trayCount,
    lineHeight: 18,
    fontVariant: ['tabular-nums'],
  },
});
