import React, { useMemo, useRef } from 'react';
import {
  GestureResponderEvent,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Orientation } from '@duoorb/game-core';
import { THEME, hexToRgba, useTheme } from '../theme';
import { BoardSkin, useBoardPalette } from '../theme/boardTheme';
import { useEquippedWallSkin } from '../theme/cosmeticsCatalog';

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
  const theme = useTheme();
  const trayPalette = useBoardPalette();
  const customWall = useEquippedWallSkin();
  const styles = useMemo(() => getTrayStyles(trayPalette), [trayPalette, theme]);
  // Neutral wall skins use the skin fence color rather than player color.
  const barColor =
    trayPalette.wallStyle === 'neutral' && trayPalette.neutralWall
      ? trayPalette.neutralWall
      : color;
  const flatBar = trayPalette.wallStyle !== 'glow';
  // Corner radius: capsule pieces for classic/tactile, or styled radius for custom skins.
  const barRadius =
    trayPalette.wallRadius === 'capsule' || trayPalette.id === 'classic'
      ? Math.min(barW, barH) / 2
      : trayPalette.wallRadius;

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
            borderRadius: barRadius,
            overflow: 'hidden',
          },
          held
            ? { backgroundColor: hexToRgba(barColor, 0.2) }
            : { backgroundColor: barColor },
          customWall && {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
          },
        ]}
      >
        {customWall && (
          <Image
            source={
              barW > barH
                ? (customWall.assets.wallTray || customWall.assets.wallH)
                : customWall.assets.wallV
            }
            style={{
              width: barW,
              height: barH,
              borderRadius: barRadius,
              opacity: held ? 0.25 : 1,
            }}
            resizeMode="stretch"
          />
        )}
      </View>
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
  const theme = useTheme();
  const trayPalette = useBoardPalette();
  const customWall = useEquippedWallSkin();
  const styles = useMemo(() => getTrayStyles(trayPalette), [trayPalette, theme]);

  const slotW = 68 * s;
  const slotH = 48 * s;

  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        {/* Horizontal Wall Column */}
        <WallPiece
          orientation="H"
          color={color}
          held={held === 'H'}
          disabled={inactive}
          barW={(swapVisuals ? 14 : 42) * s}
          barH={(swapVisuals ? 42 : 14) * s}
          touchW={slotW}
          touchH={slotH}
          label={swapVisuals ? 'Vertical' : 'Horizontal'}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />

        {/* Center Count Column: the number only */}
        <View style={[styles.countBox, { width: 50 * s, height: slotH }]}>
          <Text style={styles.countNumber}>{count}</Text>
        </View>

        {/* Vertical Wall Column */}
        <WallPiece
          orientation="V"
          color={color}
          held={held === 'V'}
          disabled={inactive}
          barW={(swapVisuals ? 42 : 14) * s}
          barH={(swapVisuals ? 14 : 42) * s}
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

// Tray styles parameterized by board skin: layout/geometry stay global,
// surface + silhouette tokens follow the active skin.
const getTrayStyles = (p: BoardSkin) =>
  StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingVertical: 4,
    paddingHorizontal: 0,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
  },
  pieceSlot: {
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: THEME.colors.outlineVariant,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieceBar: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  pieceDisabled: {
    opacity: 0.35,
  },
  countBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: THEME.colors.outlineVariant,
    borderRadius: 12,
  },
  countNumber: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
});
