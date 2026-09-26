import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BOARD_SIZE,
  BOARD_CENTER,
  CellCoord,
  GameState,
  Orientation,
  WallCoord,
  isCenterGoalMode,
  isGoalCell,
  isLegalWallPlacement,
} from '@duoorb/game-core';
import { THEME, playerColor, wallColorForPlayer, wallPreviewColor } from '../theme';

interface GameBoardProps {
  state: GameState;
  legalMoves: CellCoord[];
  previewWall?: WallCoord | null;
  selectedCell: CellCoord | null;
  interactive?: boolean;
  /**
   * Drag forwarded from the wall inventory (board-relative coords).
   * Orientation is fixed by which piece was picked up — never inferred.
   */
  externalDrag?: { orientation: Orientation; x: number; y: number } | null;
  /** Override dot/tint color (e.g. premove hints in the waiter's color). */
  moveHintColor?: string;
  /** Queued premove destinations, tinted like chess.com. */
  premoveMarks?: Array<{ to: CellCoord; color: string }>;
  /** Hide destination dots while keeping their cells tappable. */
  hideDots?: boolean;
  /** Queued wall pre-drops (translucent). Tappable to cancel while queueing. */
  queuedWalls?: Array<{ qi: number; wall: WallCoord; color: string }>;
  onQueuedWallPress?: (qi: number) => void;
  onCellPress?: (cell: CellCoord) => void;
  /** Actual analyzed move: from/to cells or wall, one restrained color. */
  moveMark?: { from?: CellCoord; to?: CellCoord; wall?: WallCoord; color: string } | null;
  /** Engine's preferred alternative: ghost wall or hollow target ring. */
  altMark?: { to?: CellCoord; wall?: WallCoord; color: string } | null;
  /** Route dots for path visualization. */
  pathDots?: Array<{ cell: CellCoord; color: string }>;
  /** Board rotation driver — orbs counter-rotate so their light spot stays on top. */
  flipAnim?: Animated.Value | null;
  /** Static board rotation in degrees for non-animated seat perspectives. */
  rotationDeg?: number;
  /** Reports the computed square board size (for drag-drop mapping). */
  onMetricsChange?: (boardSize: number) => void;
  /**
   * Explicit square size. When provided, the board fills the measured free
   * area (e.g. large tablets) instead of the default phone-oriented cap.
   */
  size?: number;
}

/** Inner padding between the board border and the cell grid. */
export const BOARD_PAD = 8;

/**
 * Active-player indicator: the orb simply grows.
 *
 * This replaced a ring, then a pointer. Both had to line themselves up
 * against the orb's edge, so their alignment depended on cell size, pixel
 * density and the orb's sub-pixel position, and they drifted on some screens
 * no matter how the geometry was tuned. Scaling the orb needs no alignment at
 * all — it is the orb itself changing size, so there is nothing to misalign.
 */
const ACTIVE_SCALE = 1.15;
const ACTIVE_PULSE = 1.04; // gentle breathing on top of the growth

/** Board geometry shared with the drag-drop drop logic. */
export function boardMetrics(boardSize: number): { cell: number; gap: number } {
  const content = boardSize - BOARD_PAD * 2;
  const gap = Math.max(5, Math.round(content * 0.018));
  const cell = (content - (BOARD_SIZE - 1) * gap) / BOARD_SIZE;
  return { cell, gap };
}

export function computeBoardSize(measuredWidth: number, fallbackWidth: number): number {
  return measuredWidth > 0 ? Math.min(measuredWidth, 680) : fallbackWidth;
}

export function nearestWallSlot(
  boardSize: number,
  x: number,
  y: number
): { row: number; col: number } {
  const { cell, gap } = boardMetrics(boardSize);
  return nearestSlot(x - BOARD_PAD, y - BOARD_PAD, cell, gap);
}

export function isInsideBoard(
  boardSize: number,
  x: number,
  y: number,
  margin = 0
): boolean {
  return x >= -margin && y >= -margin && x <= boardSize + margin && y <= boardSize + margin;
}

function nearestSlot(x: number, y: number, cell: number, gap: number) {
  let best = { row: 0, col: 0 };
  let bestDist = Infinity;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cx = (c + 1) * cell + c * gap + gap / 2;
      const cy = (r + 1) * cell + r * gap + gap / 2;
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bestDist) {
        bestDist = d;
        best = { row: r, col: c };
      }
    }
  }
  return best;
}

function wallRect(
  wall: WallCoord,
  cell: number,
  gap: number
): { top: number; left: number; width: number; height: number } {
  const isH = wall.orientation === 'H';
  return {
    top: BOARD_PAD + (isH ? (wall.row + 1) * cell + wall.row * gap : wall.row * (cell + gap)),
    left: BOARD_PAD + (isH ? wall.col * (cell + gap) : (wall.col + 1) * cell + wall.col * gap),
    width: isH ? 2 * cell + gap : gap,
    height: isH ? gap : 2 * cell + gap,
  };
}

/** Per-player animated orb position. */
function useOrbAnimations(state: GameState, cell: number, gap: number) {
  const animsRef = useRef<
    Record<string, { x: Animated.Value; y: Animated.Value; scale: Animated.Value }>
  >({});
  const prevKeyRef = useRef<string>('');
  const gameKeyRef = useRef<string>('');

  const cellTop = (r: number) => BOARD_PAD + r * (cell + gap);
  const cellLeft = (c: number) => BOARD_PAD + c * (cell + gap);

  // Ensure entries exist
  for (const p of state.players) {
    if (!animsRef.current[p.id]) {
      animsRef.current[p.id] = {
        x: new Animated.Value(cellLeft(p.position.col)),
        y: new Animated.Value(cellTop(p.position.row)),
        scale: new Animated.Value(1),
      };
    }
  }

  const posKey = state.players.map((p) => `${p.id}:${p.position.row},${p.position.col}`).join('|');
  const prevGeomRef = useRef<{ cell: number; gap: number } | null>(null);

  useEffect(() => {
    const anims = animsRef.current;
    const prevGeom = prevGeomRef.current;
    const geomChanged =
      !prevGeom || prevGeom.cell !== cell || prevGeom.gap !== gap;
    if (gameKeyRef.current !== state.gameId) {
      // New game — snap without animation
      gameKeyRef.current = state.gameId;
      for (const p of state.players) {
        anims[p.id]?.x.setValue(cellLeft(p.position.col));
        anims[p.id]?.y.setValue(cellTop(p.position.row));
      }
      prevKeyRef.current = posKey;
      prevGeomRef.current = { cell, gap };
      return;
    }
    if (geomChanged && prevKeyRef.current === posKey) {
      // Board resized (responsive layout) — re-seat orbs to the new geometry.
      for (const p of state.players) {
        anims[p.id]?.x.setValue(cellLeft(p.position.col));
        anims[p.id]?.y.setValue(cellTop(p.position.row));
      }
      prevGeomRef.current = { cell, gap };
      return;
    }
    if (prevKeyRef.current === posKey) return;
    prevKeyRef.current = posKey;
    prevGeomRef.current = { cell, gap };
    const animations: Animated.CompositeAnimation[] = [];
    for (const p of state.players) {
      const a = anims[p.id];
      if (!a) continue;
      animations.push(
        Animated.timing(a.x, {
          toValue: cellLeft(p.position.col),
          duration: THEME.animation.ballMoveMs,
          // Translate is native-drivable: the glide runs on the UI thread
          // instead of re-rendering the board from JS every frame.
          useNativeDriver: true,
        }),
        Animated.timing(a.y, {
          toValue: cellTop(p.position.row),
          duration: THEME.animation.ballMoveMs,
          useNativeDriver: true,
        })
      );
    }
    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey, cell, gap, state.gameId]);

  return animsRef.current;
}

const GameBoardView: React.FC<GameBoardProps> = ({
  state,
  legalMoves,
  previewWall = null,
  selectedCell,
  interactive = true,
  externalDrag = null,
  moveHintColor,
  premoveMarks = [],
  hideDots = false,
  queuedWalls = [],
  onQueuedWallPress,
  onCellPress,
  moveMark = null,
  altMark = null,
  pathDots = [],
  flipAnim = null,
  rotationDeg = 0,
  onMetricsChange,
  size,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);

  const fallbackWidth = Math.min(windowWidth - 32, 420);
  // Without an explicit size, respect both width and height so the board
  // grows on tablets but never overflows its screen (e.g. landscape).
  const heightBased = Math.max(240, windowHeight - 300);
  const boardSize =
    size ?? Math.min(computeBoardSize(measuredWidth, fallbackWidth), heightBased);
  const { cell: CELL, gap: GAP } = boardMetrics(boardSize);
  // Whole pixels only, so the orb's own edge stays crisp at any density.
  const orbDiameter = Math.round(CELL * 0.68);

  useEffect(() => {
    onMetricsChange?.(boardSize);
  }, [boardSize, onMetricsChange]);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentBallColor = playerColor(
    currentPlayer?.index ?? 0,
    currentPlayer?.color
  );
  const hintColor = moveHintColor ?? currentBallColor;

  const orbAnims = useOrbAnimations(state, CELL, GAP);

  // Breathing pulse layered on the active orb's growth. One shared value is
  // enough: only the active seat ever renders it.
  const [turnPulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(turnPulse, {
          toValue: ACTIVE_PULSE,
          duration: 780,
          useNativeDriver: true,
        }),
        Animated.timing(turnPulse, {
          toValue: 1,
          duration: 780,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [turnPulse]);

  // Ease the active orb up to ACTIVE_SCALE and every other orb back to rest.
  // Runs on turn/status changes only.
  useEffect(() => {
    const activeId =
      state.status === 'IN_PROGRESS'
        ? state.players[state.currentPlayerIndex]?.id
        : undefined;
    for (const p of state.players) {
      const entry = orbAnims[p.id];
      if (!entry) continue;
      Animated.timing(entry.scale, {
        toValue: p.id === activeId ? ACTIVE_SCALE : 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.currentPlayerIndex]);

  // Counter-rotation driven by the same board animation: the board spins
  // one way, each orb spins back equally, so the light spot never moves.
  const orbCounterRotation = flipAnim
    ? flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-180deg'] })
    : `${-rotationDeg}deg` as const;

  const onBoardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - measuredWidth) > 1) setMeasuredWidth(w);
  };

  const getPlayerAt = (r: number, c: number) =>
    state.players.find(
      (p) => p.status === 'ACTIVE' && p.position.row === r && p.position.col === c
    );

  const isLegalMoveTarget = (r: number, c: number) =>
    legalMoves.some((m) => m.row === r && m.col === c);

  /**
   * Subtle tint on each player's winning squares in their own ball color.
   * 2p: the whole far edge. 4p: only the middle square. Kept faint on purpose.
   */
  const goalTintFor = (r: number, c: number): string | null => {
    for (const p of state.players) {
      if (isGoalCell({ row: r, col: c }, p.goalDirection, state.mode)) {
        return hexA(playerColor(p.index, p.color), 0.1);
      }
    }
    return null;
  };

  const isPreviewValid =
    previewWall && currentPlayer
      ? isLegalWallPlacement(state, currentPlayer.id, previewWall)
      : false;

  // Fixed-orientation ghost for the wall currently held from the inventory.
  const dragSlot =
    externalDrag && currentPlayer
      ? nearestSlot(externalDrag.x - BOARD_PAD, externalDrag.y - BOARD_PAD, CELL, GAP)
      : null;
  const dragCandidate: WallCoord | null =
    externalDrag && dragSlot
      ? { row: dragSlot.row, col: dragSlot.col, orientation: externalDrag.orientation }
      : null;
  const dragLegal =
    dragCandidate && currentPlayer
      ? isLegalWallPlacement(state, currentPlayer.id, dragCandidate)
      : false;

  const playerWallBg = (playerIndex: number, color?: string) =>
    wallColorForPlayer(playerColor(playerIndex, color));

  return (
    <View style={styles.outer} onLayout={onBoardLayout}>
      <View
        style={[
          styles.container,
          { width: boardSize, height: boardSize, backgroundColor: THEME.colors.boardBackground },
        ]}
      >
        {/* Cells */}
        {Array.from({ length: BOARD_SIZE }).map((_, r) => (
          <React.Fragment key={`row-${r}`}>
            {Array.from({ length: BOARD_SIZE }).map((_, c) => {
              const occupant = getPlayerAt(r, c);
              const isLegal = isLegalMoveTarget(r, c);
              // Goal lines keep their own color — move previews never cover them.
              const goalTint = goalTintFor(r, c);
              // Queued premove target: clearly tinted in the queuer's color.
              const queuedTint = (() => {
                const mark = premoveMarks.find(
                  (m) => m.to.row === r && m.to.col === c
                );
                return mark ? hexA(mark.color, 0.3) : null;
              })();
              // Center-goal modes: the single shiny square everyone races for.
              const isCrownCell =
                isCenterGoalMode(state.mode) && r === BOARD_CENTER.row && c === BOARD_CENTER.col;
              const top = BOARD_PAD + r * (CELL + GAP);
              const left = BOARD_PAD + c * (CELL + GAP);
              return (
                <TouchableOpacity
                  key={`cell-${r}-${c}`}
                  activeOpacity={isLegal || occupant ? 0.75 : 1}
                  disabled={!interactive || (!isLegal && !occupant)}
                  onPress={() => onCellPress?.({ row: r, col: c })}
                  hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                  style={[
                    styles.cell,
                    {
                      top,
                      left,
                      width: CELL,
                      height: CELL,
                      backgroundColor:
                        queuedTint ??
                        (isCrownCell
                          ? 'rgba(217, 166, 46, 0.16)'
                          : goalTint ??
                            (isLegal && !hideDots
                              ? hexA(hintColor, 0.1)
                              : THEME.colors.cell)),
                      borderColor: THEME.colors.cellBorder,
                      borderWidth: 1,
                    },
                  ]}
                >
                  {isLegal && !occupant && !hideDots && (
                    <View
                        style={[
                        styles.legalDot,
                        {
                          width: Math.max(8, CELL * 0.22),
                          height: Math.max(8, CELL * 0.22),
                          backgroundColor: hintColor,
                        },
                      ]}
                    />
                  )}
                  {/* Shiny crown marker — shown when not covered by a move dot */}
                  {isCrownCell && !(isLegal && !occupant) && !occupant && (
                    <View
                      style={[
                        styles.crown,
                        {
                          width: CELL * 0.34,
                          height: CELL * 0.34,
                          borderRadius: (CELL * 0.34) / 4,
                        },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </React.Fragment>
        ))}

        {/* Placed walls — player colored */}
        {state.walls.map((wall) => {
          const rect = wallRect(wall, CELL, GAP);
          const owner = state.players.find((p) => p.id === wall.placedByPlayerId);
          const ball = playerColor(owner?.index ?? 0, owner?.color);
          return (
            <View
              key={`placed-${wall.row}-${wall.col}-${wall.orientation}-${wall.sequence}`}
              pointerEvents="none"
              style={[
                styles.placedWall,
                {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: playerWallBg(owner?.index ?? 0, owner?.color),
                  shadowColor: ball,
                },
              ]}
            />
          );
        })}

        {/* Wall intersection hints — visual only, not touchable.
            Walls are placed exclusively by dragging inventory pieces. */}
        {Array.from({ length: 8 }).map((_, r) =>
            Array.from({ length: 8 }).map((_, c) => {
              const top = BOARD_PAD + (r + 1) * CELL + r * GAP - 7;
              const left = BOARD_PAD + (c + 1) * CELL + c * GAP - 7;
            return (
              <View
                key={`slot-${r}-${c}`}
                pointerEvents="none"
                style={[styles.wallSlotTouchArea, { top, left }]}
              >
                <View style={styles.wallSlotPoint} />
              </View>
            );
          })
        )}

        {/* Animated orbs — no labels, color identity only. Finished players
            are off the board, so no orb remains on a freed goal cell. */}
        {state.players.map((p) => {
          if (p.status !== 'ACTIVE') return null;
          const anim = orbAnims[p.id];
          const ball = playerColor(p.index, p.color);
          const isActive = state.status === 'IN_PROGRESS' && p.id === currentPlayer?.id;
          const isSelected =
            selectedCell != null &&
            selectedCell.row === p.position.row &&
            selectedCell.col === p.position.col;
          if (!anim) return null;
          return (
            <Animated.View
              key={`orb-${p.id}`}
              pointerEvents="none"
              style={[
                styles.orbWrap,
                {
                  width: CELL,
                  height: CELL,
                  transform: [
                    { translateX: anim.x },
                    { translateY: anim.y },
                    { rotate: orbCounterRotation },
                  ],
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.orb,
                  {
                    width: orbDiameter,
                    height: orbDiameter,
                    borderRadius: 9999,
                    backgroundColor: ball,
                    shadowColor: ball,
                    transform: [
                      { scale: isSelected ? 1.08 : 1 },
                      { scale: anim.scale },
                      { scale: isActive ? turnPulse : 1 },
                    ],
                  },
                ]}
              >
                <View style={styles.orbHighlight} />
              </Animated.View>
            </Animated.View>
          );
        })}

        {/* Analysis: route dots (subtle path visualization) */}
        {pathDots.map((d, i) => {
          const s = Math.max(6, CELL * 0.16);
          return (
            <View
              key={`pd-${i}-${d.cell.row}-${d.cell.col}`}
              pointerEvents="none"
              style={[
                styles.pathDot,
                {
                  top: BOARD_PAD + d.cell.row * (CELL + GAP) + CELL / 2 - s / 2,
                  left: BOARD_PAD + d.cell.col * (CELL + GAP) + CELL / 2 - s / 2,
                  width: s,
                  height: s,
                  borderRadius: s / 2,
                  backgroundColor: d.color,
                },
              ]}
            />
          );
        })}

        {/* Analysis: actual move — from tint, to ring, slim direction bar */}
        {moveMark?.from && (
          <View
            pointerEvents="none"
            style={[
              styles.markTint,
              {
                top: BOARD_PAD + moveMark.from.row * (CELL + GAP),
                left: BOARD_PAD + moveMark.from.col * (CELL + GAP),
                width: CELL,
                height: CELL,
                backgroundColor: hexA(moveMark.color, 0.14),
              },
            ]}
          />
        )}
        {moveMark?.to && (
          <View
            pointerEvents="none"
            style={[
              styles.markRing,
              {
                top: BOARD_PAD + moveMark.to.row * (CELL + GAP) + 2,
                left: BOARD_PAD + moveMark.to.col * (CELL + GAP) + 2,
                width: CELL - 4,
                height: CELL - 4,
                borderRadius: THEME.radius.sm,
                borderColor: moveMark.color,
                backgroundColor: hexA(moveMark.color, 0.16),
              },
            ]}
          />
        )}
        {moveMark?.wall &&
          (() => {
            const rect = wallRect(moveMark.wall, CELL, GAP);
            return (
              <View
                pointerEvents="none"
                style={[
                  styles.markWall,
                  {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: hexA(moveMark.color, 0.35),
                    borderColor: moveMark.color,
                  },
                ]}
              />
            );
          })()}
        {moveMark?.from &&
          moveMark?.to &&
          (moveMark.from.row !== moveMark.to.row ||
            moveMark.from.col !== moveMark.to.col) &&
          (() => {
            const x1 = BOARD_PAD + moveMark.from!.col * (CELL + GAP) + CELL / 2;
            const y1 = BOARD_PAD + moveMark.from!.row * (CELL + GAP) + CELL / 2;
            const x2 = BOARD_PAD + moveMark.to!.col * (CELL + GAP) + CELL / 2;
            const y2 = BOARD_PAD + moveMark.to!.row * (CELL + GAP) + CELL / 2;
            const len = Math.max(0, Math.hypot(x2 - x1, y2 - y1) - CELL * 0.55);
            const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            return (
              <View
                pointerEvents="none"
                style={[
                  styles.markArrow,
                  {
                    left: (x1 + x2) / 2 - len / 2,
                    top: (y1 + y2) / 2 - 1.5,
                    width: len,
                    backgroundColor: moveMark.color,
                    transform: [{ rotate: `${angle}deg` }],
                  },
                ]}
              />
            );
          })()}

        {/* Analysis: engine alternative — ghost wall or hollow target */}
        {altMark?.wall &&
          (() => {
            const rect = wallRect(altMark.wall, CELL, GAP);
            return (
              <View
                pointerEvents="none"
                style={[
                  styles.markWall,
                  {
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    backgroundColor: hexA(altMark.color, 0.4),
                    borderColor: altMark.color,
                  },
                ]}
              />
            );
          })()}
        {altMark?.to && (
          <View
            pointerEvents="none"
            style={[
              styles.markRing,
              {
                top: BOARD_PAD + altMark.to.row * (CELL + GAP) + 2,
                left: BOARD_PAD + altMark.to.col * (CELL + GAP) + 2,
                width: CELL - 4,
                height: CELL - 4,
                borderRadius: THEME.radius.sm,
                borderColor: altMark.color,
                backgroundColor: 'transparent',
              },
            ]}
          />
        )}

        {/* External static preview (legacy / replay-safe) */}
        {previewWall &&
          (() => {
            const rect = wallRect(previewWall, CELL, GAP);
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
                    backgroundColor: isPreviewValid
                      ? currentBallColor
                      : 'rgba(220, 38, 38, 0.35)',
                  },
                ]}
              />
            );
          })()}

        {/* Queued wall pre-drops — faint ghosts, tappable to cancel */}
        {queuedWalls.map((q) => {
          const rect = wallRect(q.wall, CELL, GAP);
          return (
            <TouchableOpacity
              key={`qw-${q.qi}-${q.wall.row}-${q.wall.col}-${q.wall.orientation}`}
              activeOpacity={0.6}
              disabled={!onQueuedWallPress}
              onPress={() => onQueuedWallPress?.(q.qi)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.previewWall,
                {
                  top: rect.top,
                  left: rect.left,
                  width: rect.width,
                  height: rect.height,
                  backgroundColor: wallPreviewColor(q.color, 0.32),
                },
              ]}
            />
          );
        })}

        {/* Inventory drag ghost — single fixed-orientation preview, snapped */}
        {dragCandidate &&
          (() => {
            const rect = wallRect(dragCandidate, CELL, GAP);
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
                    backgroundColor: dragLegal
                      ? wallPreviewColor(hintColor)
                      : 'rgba(220, 38, 38, 0.45)',
                  },
                ]}
              />
            );
          })()}
      </View>
    </View>
  );
};

/**
 * Memoized: the board only re-renders when its actual inputs change.
 * Clock ticks, modal state and other GameScreen state skip the ~300-view
 * subtree entirely as long as every prop below stays referentially stable
 * (GameScreen memoizes the derived arrays/objects it passes).
 */
export const GameBoard = memo(GameBoardView);

function hexA(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
    userSelect: 'none',
  },
  container: {
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
    alignSelf: 'center',
    ...THEME.shadows.card,
  },
  cell: {
    position: 'absolute',
    borderRadius: THEME.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legalDot: {
    opacity: 0.55,
    borderRadius: 999,
  },
  crown: {
    backgroundColor: '#D9A62E',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#D9A62E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    opacity: 0.9,
  },
  orbWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  orb: {
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.shadows.orb,
    position: 'relative',
    overflow: 'hidden',
  },
  orbHighlight: {
    position: 'absolute',
    top: '10%',
    left: '16%',
    width: '34%',
    height: '26%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  placedWall: {
    position: 'absolute',
    borderRadius: 4,
    ...THEME.shadows.wall,
    zIndex: 10,
  },
  previewWall: {
    position: 'absolute',
    borderRadius: 4,
    zIndex: 30,
  },
  pathDot: {
    position: 'absolute',
    opacity: 0.45,
    zIndex: 5,
  },
  markTint: {
    position: 'absolute',
    borderRadius: THEME.radius.sm,
    zIndex: 24,
  },
  markRing: {
    position: 'absolute',
    borderWidth: 2,
    zIndex: 25,
  },
  markWall: {
    position: 'absolute',
    borderRadius: 4,
    borderWidth: 1.5,
    zIndex: 25,
  },
  markArrow: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    opacity: 0.75,
    zIndex: 26,
  },
  wallSlotTouchArea: {
    position: 'absolute',
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  wallSlotPoint: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: THEME.colors.wallSlot,
  },
});
