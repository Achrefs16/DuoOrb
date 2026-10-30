import React, { createContext, memo, useContext } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { WallCoord } from '@duoorb/game-core';
import { wallRect } from './GameBoard';
import { useBoardSkin } from '../theme/boardTheme';
import { useEquippedWallSkin } from '../theme/cosmeticsCatalog';

/**
 * Drag-ghost state, kept OUT of GameBoard's props on purpose.
 *
 * The board renders roughly 300 native views (81 cells, 64 wall slots, plus
 * marks and orbs). When the held wall was dragged, GameScreen passed the
 * snapped slot down as a prop, so every slot crossing re-rendered the whole
 * board: ~150 freshly allocated style objects and colour strings, then a full
 * reconcile of every child. That is what capped dragging a held wall across
 * the board at ~15fps. Dragging outside the board was smooth precisely because
 * no slot was produced, so the board's props stayed stable and the memo bailed
 * out — the exact symptom that pointed at the board rather than the drag.
 *
 * The ghost now subscribes to this context instead, so a slot change re-renders
 * one small view and leaves the board untouched. Visual output is identical:
 * same component tree position, same styles, same z-order.
 */
export interface WallDragGhostState {
  slot: WallCoord | null;
  legal: boolean;
  color: string;
}

const WallDragGhostContext = createContext<WallDragGhostState>({
  slot: null,
  legal: false,
  color: 'rgba(220, 38, 38, 0.45)',
});

export const WallDragGhostProvider = WallDragGhostContext.Provider;

/**
 * Geometry and styling are taken straight from GameBoard so the ghost lands on
 * exactly the same pixels, with the same border radius and z-order, as the
 * inline ghost it replaces.
 */
interface DragGhostProps {
  cell: number;
  gap: number;
}

/**
 * The held-wall preview. Memoised and context-driven, so it is the only thing
 * that re-renders while a wall is being dragged over the board.
 */
export const WallDragGhost = memo(function WallDragGhost({ cell, gap }: DragGhostProps) {
  const { slot, legal, color } = useContext(WallDragGhostContext);
  const skin = useBoardSkin();
  const customWall = useEquippedWallSkin();
  if (!slot) return null;
  const rect = wallRect(slot, cell, gap);
  const isH = slot.orientation === 'H';
  const thicknessExtra = Math.max(3, Math.round(gap * 0.45));
  const top = isH ? rect.top - thicknessExtra / 2 : rect.top;
  const left = isH ? rect.left : rect.left - thicknessExtra / 2;
  const width = isH ? rect.width : rect.width + thicknessExtra;
  const height = isH ? rect.height + thicknessExtra : rect.height;

  // Held preview wears the skin like a placed wall: neutral fences preview
  // as wood, so tray → drag → placed never changes design mid-gesture.
  const neutral = skin.wallStyle === 'neutral' && skin.neutralWall;

  if (customWall && legal) {
    return (
      <View
        pointerEvents="none"
        style={[
          styles.previewWall,
          {
            top,
            left,
            width,
            height,
            overflow: 'hidden',
            borderRadius:
              skin.wallRadius === 'capsule'
                ? Math.min(width, height) / 2
                : skin.wallRadius,
          },
        ]}
      >
        <Image
          source={slot.orientation === 'H' ? customWall.assets.wallH : customWall.assets.wallV}
          style={{ width, height, opacity: 0.8 }}
          resizeMode="stretch"
        />
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.previewWall,
        {
          top,
          left,
          width,
          height,
          backgroundColor: !legal
            ? 'rgba(220, 38, 38, 0.45)'
            : neutral
              ? neutral
              : color,
          borderRadius:
            skin.wallRadius === 'capsule'
              ? Math.min(width, height) / 2
              : skin.wallRadius,
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  previewWall: {
    position: 'absolute',
    borderRadius: 4,
    zIndex: 30,
  },
});
