import React, { createContext, memo, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WallCoord } from '@duoorb/game-core';
import { wallRect } from './GameBoard';

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
  if (!slot) return null;
  const rect = wallRect(slot, cell, gap);
  return (
    <View
      pointerEvents="none"
      style={[
        styles.previewWall,
        {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          backgroundColor: legal ? color : 'rgba(220, 38, 38, 0.45)',
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
