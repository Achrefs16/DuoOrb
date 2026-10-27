import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrbIcon } from '../components/OrbIcon';
import {
  CellCoord,
  WallCoord,
  Orientation,
  getShortestPath,
  getLegalMoves,
} from '@duoorb/game-core';
import {
  GameBoard,
  BOARD_PAD,
  boardMetrics,
  wallRect,
  nearestWallSlot,
  isInsideBoard,
  boardRim,
} from '../components/GameBoard';
import { WallTray } from '../components/WallTray';
import { WallDragGhostProvider } from '../components/WallDragGhost';
import { TutorialHandGuide, TutorialGesture } from '../components/TutorialHandGuide';
import { TUTORIAL_SCENARIOS } from '../tutorial/tutorialScenarios';
import { markTutorialComplete } from '../storage/tutorial';
import {
  playOwnMoveSound,
  playJumpSound,
  playWallSound,
  playGoalSound,
  playIllegalMoveSound,
} from '../audio/sounds';
import { THEME, playerColor, wallPreviewColor, useStyles } from '../theme';
import { useBoardSkin } from '../theme/boardTheme';

interface TutorialScreenProps {
  onFinish: () => void;
  onSkip?: () => void;
}

interface WallDragState {
  orientation: Orientation;
  pageX: number;
  pageY: number;
}

export const TutorialScreen: React.FC<TutorialScreenProps> = ({ onFinish, onSkip }) => {
  const styles = useStyles(createStyles);
  const skin = useBoardSkin();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = TUTORIAL_SCENARIOS[scenarioIndex];

  // Current interactive game state for the scenario
  const [gameState, setGameState] = useState(scenario.initialState);
  const [stepSolved, setStepSolved] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellCoord | null>(
    scenario.targetAction.type === 'MOVE' ? scenario.initialState.players[0].position : null
  );

  // Detour path dots for Scenario 2
  const [detourDots, setDetourDots] = useState<Array<{ cell: CellCoord; color: string }>>([]);

  // Active wall dragging state
  const [wallDrag, setWallDrag] = useState<WallDragState | null>(null);
  const wallDragRef = useRef<WallDragState | null>(null);
  const dragFrameRef = useRef<number | null>(null);

  // Geometry references matching GameScreen.tsx
  const rootRef = useRef<View>(null);
  const rootRectRef = useRef<{ x: number; y: number } | null>(null);
  const anchorRef = useRef<View>(null);
  const anchorRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const trayRef = useRef<View>(null);
  const trayRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const [layoutNonce, setLayoutNonce] = useState(0);

  const triggerMeasure = useCallback(() => {
    rootRef.current?.measureInWindow((rx, ry) => {
      rootRectRef.current = { x: rx, y: ry };
    });
    anchorRef.current?.measureInWindow((ax, ay, aw, ah) => {
      anchorRectRef.current = { x: ax, y: ay, w: aw, h: ah };
      setLayoutNonce((n) => n + 1);
    });
    trayRef.current?.measureInWindow((tx, ty, tw, th) => {
      trayRectRef.current = { x: tx, y: ty, w: tw, h: th };
      setLayoutNonce((n) => n + 1);
    });
  }, []);

  // Board dimensions: fit the measured free area (works on web windows of
  // any size, not just phone-shaped ones).
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);
  const [bottomH, setBottomH] = useState(0);
  const measuredBoardSize = useMemo(() => {
    const maxW = wrapSize ? wrapSize.w - 28 : windowWidth - 28;
    const maxH = wrapSize
      ? wrapSize.h - bottomH - 12
      : windowHeight * 0.5;
    return Math.max(200, Math.floor(Math.min(maxW, maxH, 440)));
  }, [wrapSize, bottomH, windowWidth, windowHeight]);

  useEffect(() => {
    const id = setTimeout(triggerMeasure, 60);
    return () => clearTimeout(id);
  }, [measuredBoardSize, triggerMeasure]);

  const boardSizeRef = useRef(measuredBoardSize);
  boardSizeRef.current = measuredBoardSize;

  // Whenever scenario changes, reset puzzle
  useEffect(() => {
    setGameState(scenario.initialState);
    setStepSolved(false);
    setSelectedCell(
      scenario.targetAction.type === 'MOVE' ? scenario.initialState.players[0].position : null
    );
    setDetourDots([]);
    setWallDrag(null);
    wallDragRef.current = null;
    setTimeout(triggerMeasure, 50);
  }, [scenarioIndex, scenario, triggerMeasure]);

  // Player & Tray color
  const humanPlayer = gameState.players[0];
  const oppPlayer = gameState.players[1];
  const trayColor = playerColor(0, humanPlayer.color);

  // Legal moves for piece movement
  const legalMoves = useMemo(() => {
    if (stepSolved) return [];
    if (scenario.targetAction.type === 'MOVE') {
      return [scenario.targetAction.to];
    }
    return [];
  }, [scenario, stepSolved]);

  // Touch mapping from screen space to board space
  const toBoardPoint = useCallback(
    (pageX: number, pageY: number): { x: number; y: number; boardSize: number } | null => {
      const rect = anchorRectRef.current;
      if (!rect) return null;
      const boardSize = boardSizeRef.current;
      const boardLeft = rect.x + (rect.w - boardSize) / 2;
      const boardTop = rect.y;
      return { x: pageX - boardLeft, y: pageY - boardTop, boardSize };
    },
    []
  );

  // Snapped wall slot under held drag
  const dragSlotRaw = useMemo((): WallCoord | null => {
    if (!wallDrag) return null;
    const pt = toBoardPoint(wallDrag.pageX, wallDrag.pageY);
    if (!pt || !isInsideBoard(pt.boardSize, pt.x, pt.y, 20)) return null;

    const slot = nearestWallSlot(
      pt.boardSize,
      pt.x,
      pt.y,
      boardRim(skin.frameBorderWidth),
      skin.cellGap
    );
    return {
      row: slot.row,
      col: slot.col,
      orientation: wallDrag.orientation,
    };
  }, [wallDrag, toBoardPoint, skin]);

  // Drag ghost preview passed to GameBoard
  const dragGhostValue = useMemo(() => {
    if (!dragSlotRaw) return { slot: null, legal: false, color: trayColor };
    const isTarget =
      scenario.targetAction.type === 'PLACE_WALL' &&
      dragSlotRaw.row === scenario.targetAction.wall.row &&
      dragSlotRaw.col === scenario.targetAction.wall.col &&
      dragSlotRaw.orientation === scenario.targetAction.wall.orientation;
    return {
      slot: dragSlotRaw,
      legal: isTarget,
      color: wallPreviewColor(trayColor),
    };
  }, [dragSlotRaw, scenario, trayColor]);

  // Drag chip following the finger on screen
  const chipStyle = useMemo(() => {
    if (!wallDrag || !rootRectRef.current) return null;
    const trayScale = Math.max(0.72, Math.min(1, windowWidth / 390));
    const isH = wallDrag.orientation === 'H';
    const w = (isH ? 56 : 12) * trayScale;
    const h = (isH ? 12 : 56) * trayScale;
    return {
      left: wallDrag.pageX - rootRectRef.current.x - w / 2,
      top: wallDrag.pageY - rootRectRef.current.y - h / 2,
      width: w,
      height: h,
    };
  }, [wallDrag, windowWidth]);

  // Drag handlers from WallTray matching GameScreen
  const handleTrayStart = (orientation: Orientation, pageX: number, pageY: number) => {
    if (stepSolved) return;
    triggerMeasure();
    const drag: WallDragState = { orientation, pageX, pageY };
    wallDragRef.current = drag;
    setWallDrag(drag);
  };

  const handleTrayMove = (pageX: number, pageY: number) => {
    if (stepSolved || !wallDragRef.current) return;
    const next: WallDragState = { ...wallDragRef.current, pageX, pageY };
    wallDragRef.current = next;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      setWallDrag(wallDragRef.current);
    });
  };

  const handlePlaceWall = (candidate: WallCoord) => {
    if (stepSolved) return;
    if (scenario.targetAction.type === 'PLACE_WALL') {
      const target = scenario.targetAction.wall;
      if (
        candidate.row === target.row &&
        candidate.col === target.col &&
        candidate.orientation === target.orientation
      ) {
        // Solved!
        const nextWalls = [
          ...gameState.walls,
          {
            ...target,
            placedByPlayerId: humanPlayer.id,
            sequence: gameState.walls.length + 1,
          },
        ];
        const nextState = {
          ...gameState,
          walls: nextWalls,
          players: gameState.players.map((p, idx) =>
            idx === 0 ? { ...p, wallsRemaining: p.wallsRemaining - 1 } : p
          ),
        };
        setGameState(nextState);
        setStepSolved(true);
        playWallSound();

        // For Scenario 2, compute and show the opponent's long detour
        if (scenario.id === 2) {
          const opp = nextState.players[1];
          const newPath = getShortestPath(opp.position, opp.goalDirection, nextWalls);
          if (newPath) {
            setDetourDots(
              newPath.map((c) => ({
                cell: c,
                color: THEME.colors.warning ?? '#F59E0B',
              }))
            );
          }
        }
      } else {
        playIllegalMoveSound();
      }
    }
  };

  const handleTrayEnd = (pageX: number, pageY: number) => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const drag = wallDragRef.current;
    wallDragRef.current = null;
    setWallDrag(null);
    if (!drag || stepSolved) return;

    const pt = toBoardPoint(pageX, pageY);
    if (!pt || !isInsideBoard(pt.boardSize, pt.x, pt.y, 40)) return;

    const slot = nearestWallSlot(
      pt.boardSize,
      pt.x,
      pt.y,
      boardRim(skin.frameBorderWidth),
      skin.cellGap
    );
    const candidate: WallCoord = {
      row: slot.row,
      col: slot.col,
      orientation: drag.orientation,
    };
    handlePlaceWall(candidate);
  };

  // Cell press handler (moving orbs)
  const handleCellPress = (cellCoord: CellCoord) => {
    if (stepSolved) return;

    if (scenario.targetAction.type === 'MOVE') {
      const target = scenario.targetAction.to;
      if (cellCoord.row === target.row && cellCoord.col === target.col) {
        const nextState = { ...gameState };
        nextState.players = nextState.players.map((p, idx) =>
          idx === 0 ? { ...p, position: target } : p
        );
        setGameState(nextState);
        setStepSolved(true);

        if (scenario.id === 1) {
          playGoalSound();
        } else if (scenario.id === 3) {
          playJumpSound();
        } else {
          playOwnMoveSound();
        }
      } else {
        playIllegalMoveSound();
      }
    }
  };

  // Hand gesture coordinate mapping
  const handGesture = useMemo((): TutorialGesture | null => {
    if (stepSolved || wallDrag) return null;
    const g = scenario.handGesture;

    const rect = anchorRectRef.current;
    const root = rootRectRef.current;
    if (!rect || !root) return null;

    const boardSize = boardSizeRef.current;
    const boardLeft = rect.x - root.x + (rect.w - boardSize) / 2;
    const boardTop = rect.y - root.y;

    const rim = boardRim(skin.frameBorderWidth);
    const { cell, gap } = boardMetrics(boardSize, rim, skin.cellGap);

    const frame = skin.frameBorderWidth;
    const getCellPos = (c: CellCoord) => ({
      x: boardLeft + frame + BOARD_PAD + c.col * (cell + gap) + cell / 2,
      y: boardTop + frame + BOARD_PAD + c.row * (cell + gap) + cell / 2,
    });

    const getWallPos = (w: WallCoord) => {
      const r = wallRect(w, cell, gap);
      return {
        x: boardLeft + frame + r.left + r.width / 2,
        y: boardTop + frame + r.top + r.height / 2,
      };
    };

    if (g.type === 'tap' && g.toCell) {
      return {
        type: 'tap',
        from: getCellPos(g.toCell),
      };
    }

    if (g.type === 'jump' && g.fromCell && g.toCell) {
      return {
        type: 'jump',
        from: getCellPos(g.fromCell),
        to: getCellPos(g.toCell),
      };
    }

    if (g.type === 'drag' && g.toWall) {
      const targetPos = getWallPos(g.toWall);
      const trayScale = Math.max(0.8, Math.min(1, windowWidth / 390));
      // WallTray: H piece on the left, V piece on the right (69px from center)
      const side = g.toWall.orientation === 'V' ? 1 : -1;
      const trayX =
        (trayRectRef.current?.x ?? 0) -
        root.x +
        (trayRectRef.current?.w ?? windowWidth) / 2 +
        side * 69 * trayScale;
      const trayY =
        (trayRectRef.current?.y ?? (boardTop + boardSize + 50)) -
        root.y +
        (trayRectRef.current?.h ?? 48) / 2;

      return {
        type: 'drag',
        from: { x: trayX, y: trayY },
        to: targetPos,
      };
    }

    return null;
  }, [scenario, stepSolved, wallDrag, skin, windowWidth, layoutNonce]);

  const handleNextStep = () => {
    if (scenarioIndex < TUTORIAL_SCENARIOS.length - 1) {
      setScenarioIndex(scenarioIndex + 1);
    } else {
      void markTutorialComplete();
      onFinish();
    }
  };

  const handleSkip = () => {
    void markTutorialComplete();
    if (onSkip) onSkip();
    else onFinish();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View
        ref={rootRef}
        collapsable={false}
        onLayout={triggerMeasure}
        style={styles.container}
      >
        {/* Sleek Minimal Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={scenarioIndex > 0 ? () => setScenarioIndex(scenarioIndex - 1) : handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Back"
          >
            <OrbIcon name="chevron-left" size={24} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          {/* Clean Step Dots */}
          <View style={styles.dotsWrap}>
            {TUTORIAL_SCENARIOS.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  styles.dot,
                  idx === scenarioIndex && styles.dotActive,
                  idx < scenarioIndex && styles.dotDone,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Skip"
          >
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Minimal Clean Instruction (DuoOrb identity, no artificial cards) */}
        <View style={styles.instructionWrap}>
          <Text style={styles.instructionTitle}>{scenario.title}</Text>
          <Text style={styles.instructionSubtitle}>
            {stepSolved ? scenario.successMessage : scenario.instruction}
          </Text>
        </View>

        {/* Opponent Minimal Bar */}
        <View style={styles.oppBar}>
          <View style={styles.playerIdentity}>
            <View style={[styles.avatarDot, { backgroundColor: playerColor(1, oppPlayer.color) }]}>
              <Text style={styles.avatarInitial}>O</Text>
            </View>
            <Text style={styles.playerName}>Opponent</Text>
          </View>
          <View style={styles.wallCountChip}>
            <OrbIcon name="wall" size={13} color={THEME.colors.textSecondary} />
            <Text style={styles.wallCountText}>{oppPlayer.wallsRemaining}</Text>
          </View>
        </View>

        {/* Board Section — Exact layout from GameScreen.tsx */}
        <View
          style={styles.boardWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setWrapSize((prev) =>
              prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
                ? prev
                : { w: width, h: height }
            );
          }}
        >
          <View
            ref={anchorRef}
            collapsable={false}
            onLayout={triggerMeasure}
            style={styles.boardAnchor}
          >
            <WallDragGhostProvider value={dragGhostValue}>
              <GameBoard
                state={gameState}
                legalMoves={legalMoves}
                selectedCell={selectedCell}
                interactive={!stepSolved && !wallDrag}
                size={measuredBoardSize}
                pathDots={detourDots}
                onCellPress={handleCellPress}
              />
            </WallDragGhostProvider>
          </View>

          {/* Player Bar + Inventory Tray — Exact layout from GameScreen.tsx */}
          <View
            style={styles.bottomBar}
            onLayout={(e) => {
              const { height } = e.nativeEvent.layout;
              setBottomH((prev) => (Math.abs(prev - height) > 1 ? height : prev));
            }}
          >
            <View style={styles.playerBar}>
              <View style={styles.playerIdentity}>
                <View style={[styles.avatarDot, { backgroundColor: trayColor }]}>
                  <Text style={styles.avatarInitial}>Y</Text>
                </View>
                <Text style={styles.playerName}>You</Text>
              </View>
              <View style={styles.wallCountChip}>
                <OrbIcon name="wall" size={13} color={THEME.colors.textSecondary} />
                <Text style={styles.wallCountText}>{humanPlayer.wallsRemaining}</Text>
              </View>
            </View>

            {/* Tray Slot or Continue Button */}
            <View ref={trayRef} onLayout={triggerMeasure} style={styles.traySlot}>
              {stepSolved ? (
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handleNextStep}
                  activeOpacity={0.85}
                >
                  <Text style={styles.continueBtnText}>
                    {scenarioIndex < TUTORIAL_SCENARIOS.length - 1 ? 'Continue' : 'Start Playing'}
                  </Text>
                  <OrbIcon name="arrow-right" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                scenario.targetAction.type === 'PLACE_WALL' && (
                  <WallTray
                    color={trayColor}
                    count={humanPlayer.wallsRemaining}
                    held={wallDrag?.orientation ?? null}
                    disabled={stepSolved}
                    onDragStart={handleTrayStart}
                    onDragMove={handleTrayMove}
                    onDragEnd={handleTrayEnd}
                  />
                )
              )}
            </View>
          </View>
        </View>

        {/* Held wall chip following finger during active drag */}
        {wallDrag && chipStyle && (
          <View
            pointerEvents="none"
            style={[
              styles.dragChip,
              {
                left: chipStyle.left,
                top: chipStyle.top,
                width: chipStyle.width,
                height: chipStyle.height,
                borderRadius:
                  skin.wallRadius === 'capsule'
                    ? Math.min(chipStyle.width, chipStyle.height) / 2
                    : typeof skin.wallRadius === 'number'
                    ? skin.wallRadius
                    : Math.min(chipStyle.width, chipStyle.height) / 2,
                backgroundColor:
                  skin.wallStyle === 'neutral' && skin.neutralWall
                    ? skin.neutralWall
                    : trayColor,
              },
            ]}
          />
        )}

        {/* Pointing Hand Guide overlay */}
        <TutorialHandGuide gesture={handGesture} visible={!stepSolved && !wallDrag} />
      </View>
    </SafeAreaView>
  );
};

const createStyles = () =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: THEME.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: THEME.colors.background,
      justifyContent: 'space-between',
      userSelect: 'none',
      ...(Platform.OS === 'web' ? { overflowY: 'auto' as any } : {}),
    },
    header: {
      height: 48,
      backgroundColor: THEME.colors.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: THEME.colors.outlineVariant,
    },
    dotsWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: THEME.colors.outlineVariant,
    },
    dotActive: {
      width: 20,
      backgroundColor: THEME.colors.primary,
    },
    dotDone: {
      backgroundColor: THEME.colors.primary,
    },
    skipBtnText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textMuted,
    },
    instructionWrap: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
      alignItems: 'center',
    },
    instructionTitle: {
      fontFamily: THEME.fonts.bold,
      fontSize: 16,
      fontWeight: '800',
      color: THEME.colors.textPrimary,
      marginBottom: 3,
      textAlign: 'center',
    },
    instructionSubtitle: {
      fontFamily: THEME.fonts.medium,
      fontSize: 13,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    oppBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 4,
    },
    playerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 4,
    },
    playerIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    avatarDot: {
      width: 26,
      height: 26,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    playerName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
    },
    wallCountChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      gap: 4,
    },
    wallCountText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    boardWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 14,
    },
    boardAnchor: {
      width: '100%',
      alignItems: 'center',
    },
    bottomBar: {
      width: '100%',
      alignItems: 'stretch',
      marginTop: 8,
    },
    traySlot: {
      minHeight: 56,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 4,
    },
    continueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    continueBtnText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    dragChip: {
      position: 'absolute',
      zIndex: 100,
      opacity: 0.95,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 8,
    },
  });
