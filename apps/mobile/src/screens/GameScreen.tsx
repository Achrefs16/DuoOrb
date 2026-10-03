import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AIDifficulty,
  AI_PROFILES,
  CellCoord,
  GameAction,
  GameMode,
  GameState,
  Orientation,
  WallCoord,
  applyAction,
  boardOf,
  createInitialState,
  forfeitMatch,
  getBestActionAsync,
  getLegalMoves,
  getLegalMovesFrom,
  isLegalWallPlacement,
  playerCountForMode,
  rebuildStateAtStep,
  routeOf,
} from '@duoorb/game-core';
import { Feather } from '@expo/vector-icons';
import type { GameSyncDto } from '@duoorb/protocol';
import { GameBoard, isInsideBoard, nearestWallSlot } from '../components/GameBoard';
import { PlayerStrip, type SeatStatus } from '../components/GameHud';
import { GameOverModal } from '../components/GameOverModal';
import { PlayerProfileScreen } from './PlayerProfileScreen';
import { SideChoice } from './MatchSetupScreen';
import { WallTray } from '../components/WallTray';
import { playGoalSound, playOwnMoveSound, playOpponentMoveSound, playJumpSound, playWallSound, playGameStartSound, playGameEndSound, playIllegalMoveSound, playNotifySound, playThirtySecondsSound, preloadSounds } from '../audio/sounds';
import { toast } from '../components/AppToast';
import { AchievementMedal } from '../components/AchievementMedal';
import { SavedGameRecord, loadOnlineGameSnapshot, saveGameToHistory, saveOnlineGameSnapshot } from '../storage/gameStorage';
import { AiWinReward, SubmitAiWinBody } from '../network/apiClient';
import { flushAiWinQueue, reportHardAiWin } from '../aiwins/aiWins';
import { THEME, playerColor, wallPreviewColor } from '../theme';
import { CLOCK_ENABLED, DEFAULT_TIME_CONTROL, TimeControl, effectiveIncrement } from '../timeControls';
import { useOnlineGame } from '../network/useOnlineGame';
import { useQuickReactions } from '../network/useQuickReactions';
import { ReactionDock, ReactionTray } from '../components/QuickReactions';
import type { ReactionKind } from '../network/useQuickReactions';
import { WallDragGhostProvider } from '../components/WallDragGhost';
import { useIdentity } from '../network/auth';
import { socketManager } from '../network/socket';
// Serializes a finished hard-AI win for the server upload (achievements).
import { formatGame } from '@duoorb/game-core';

interface GameScreenProps {
  mode: GameMode;
  type: 'local' | 'ai' | 'online';
  onlineGameId?: string;
  onlineSource?: 'quick' | 'custom' | 'room';
  /**
   * First sync snapshot from the pre-game join gate, when the entry was
   * gated. The board renders from it on the first frame — this screen never
   * shows a connecting state.
   */
  initialOnlineSnapshot?: GameSyncDto | null;
  aiDifficulty?: AIDifficulty;
  timeControl?: TimeControl;
  incrementEnabled?: boolean;
  premoveEnabled?: boolean;
  extendedQueue?: boolean;
  testThink?: boolean;
  sideChoice?: SideChoice;
  onHome: () => void;
  onNewGame: () => void;
  onRematchAccepted?: (newGameId: string) => void;
  onAnalyze: (initialState: GameState, history: any[], perspectiveIdx: number) => void;
  /** Opens the shared player profile for a seat that has an account behind it. */
  onOpenPlayerProfile?: (player: { userId: string; username: string }) => void;
  wallsEach?: number;
}

interface WallDrag {
  orientation: Orientation;
  pageX: number;
  pageY: number;
}

function playerNamesFor(
  mode: GameMode,
  type: 'local' | 'ai' | 'online',
  aiDifficulty: AIDifficulty,
  humanIdx: number,
  ownName: string
) {
  const n = playerCountForMode(mode);
  if (type === 'ai') {
    if (mode === '2p') return humanIdx === 0 ? [ownName, `AI · ${aiDifficulty}`] : [`AI · ${aiDifficulty}`, ownName];
    // AI games: you lead, every other seat is an AI opponent.
    return Array.from({ length: n }, (_, i) =>
      i === 0 ? ownName : i === 1 ? 'AI' : `AI ${i}`
    );
  }
  if (type === 'online') {
    if (mode === '2p') return humanIdx === 0 ? [ownName, 'Opponent'] : ['Opponent', ownName];
    return Array.from({ length: n }, (_, i) => (i === humanIdx ? ownName : `Player ${i + 1}`));
  }
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

/** Shared frozen empty list: keeps memoized-board props referentially stable. */
const EMPTY_CELL_LIST: CellCoord[] = [];
const EMPTY_PREMOVE_MARKS: { to: CellCoord; color: string }[] = [];
const EMPTY_QUEUED_WALLS: { qi: number; wall: WallCoord; color: string }[] = [];

/** Thinking beat per difficulty — long enough to queue a premove. */
function thinkMsFor(difficulty: AIDifficulty, testThink: boolean): number {
  if (testThink) return 10000;
  switch (difficulty) {
    case 'easy':
      return 350;
    case 'hard':
      return 800;
    case 'normal':
    default:
      return 700;
  }
}

/**
 * Board perspective from a seat's goal direction — the one seat attribute
 * that never changes mid-game.
 *
 * Your spawn sits at the bottom in every mode: a TOP goal means you start
 * bottom (0°), BOTTOM means you start top (180°), RIGHT means you start left
 * (270°), LEFT means you start right (90°).
 *
 * This deliberately reads NOTHING positional. An earlier version derived the
 * angle from the pawn's spawn cell with a live-position fallback, so any seat
 * outside the locally built layout (e.g. green/yellow in a joined room whose
 * local mode defaulted to 2p) flipped the whole board the moment the pawn
 * left its spawn column — and a wrong local mode rotated Race goals onto the
 * side or bottom. Goal direction is set once at creation on every state the
 * server, snapshots and replays ever produce, so the angle is stable from the
 * first frame to the last.
 */
function desiredRotationDeg(
  goalDirection?: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'
): number {
  switch (goalDirection) {
    case 'BOTTOM':
      return 180;
    case 'RIGHT':
      return 270;
    case 'LEFT':
      return 90;
    case 'TOP':
    default:
      return 0;
  }
}

export const GameScreen: React.FC<GameScreenProps> = ({
  mode,
  type,
  onlineGameId,
  onlineSource = 'quick',
  initialOnlineSnapshot = null,
  aiDifficulty = 'normal',
  timeControl = DEFAULT_TIME_CONTROL,
  incrementEnabled = true,
  premoveEnabled = true,
  extendedQueue = true,
  testThink = false,
  sideChoice = 'blue',
  wallsEach,
  onHome,
  onNewGame,
  onRematchAccepted,
  onAnalyze,
  // Accepted for API compatibility (App passes it) but intentionally
  // unused: opponent profiles open as an in-game overlay so this screen
  // never unmounts mid-match. See profilePlayer.
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const identity = useIdentity();

  const online = useOnlineGame({
    gameId: onlineGameId || '',
    // Online only: a stale snapshot from a previous match must never seed a
    // local/AI board (or a rematch-less remount) with a foreign seat.
    initialSync: type === 'online' ? initialOnlineSnapshot ?? null : null,
  });
  // Stable pieces of the (fresh-every-render) online hook object, so
  // memoized callbacks below don't churn with every parent render.
  const onlineConnStatus = online.connStatus;
  const onlineSendAction = online.sendAction;
  const [offlineSnapshot, setOfflineSnapshot] = useState<Awaited<ReturnType<typeof loadOnlineGameSnapshot>>>(null);

  // Your side in classic AI games, resolved once per mount (random = 50/50
  // coin flip). In online games, resolved directly by server seat assignment.
  const [humanIdx, setHumanIdx] = useState(() => {
    if (type !== 'ai' || mode !== '2p') return 0;
    if (sideChoice === 'red') return 1;
    if (sideChoice === 'random') return Math.random() < 0.5 ? 0 : 1;
    return 0;
  });

  useEffect(() => {
    if (type === 'online') {
      setHumanIdx(online.myPlayerIndex);
    }
  }, [type, online.myPlayerIndex]);

  // Every non-human seat in an AI game is AI-controlled
  const isAiSide = (idx: number) => type === 'ai' && idx !== humanIdx;
  const [initialState, setInitialState] = useState<GameState>(() =>
    createInitialState({ mode, playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, identity?.displayName ?? 'You'), wallsEach })
  );

  const [state, setState] = useState<GameState>(initialState);

  // Cached last-known online state keeps the finished/live board visible
  // during reconnects. The server still replaces it on the next sync.
  useEffect(() => {
    let cancelled = false;
    if (type === 'online' && onlineGameId) {
      void loadOnlineGameSnapshot(onlineGameId).then((snapshot) => {
        if (cancelled || !snapshot || online.gameState) return;
        setOfflineSnapshot(snapshot);
        setState(snapshot.state);
        setTimers(snapshot.clocks);
        if (snapshot.myPlayerIndex >= 0) setHumanIdx(snapshot.myPlayerIndex);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [type, onlineGameId, online.gameState]);

  // Persist the minimum useful recovery data whenever live truth arrives.
  // Guarded to the matching game: during a rematch switch the hook still
  // holds the previous board, which must never be saved under the new id.
  useEffect(() => {
    if (type === 'online' && onlineGameId && online.gameState && online.gameState.gameId === onlineGameId) {
      void saveOnlineGameSnapshot({
        gameId: onlineGameId,
        state: online.gameState,
        clocks: online.clocks,
        myPlayerId: online.myPlayerId,
        myPlayerIndex: online.myPlayerIndex,
        savedAt: Date.now(),
      });
    }
  }, [type, onlineGameId, online.gameState, online.clocks, online.myPlayerId, online.myPlayerIndex]);

  /**
   * Board rendered from the online state. For online play that is the
   * OPTIMISTIC derivation — confirmed server state with our own unconfirmed
   * move replayed on top — so a tap moves the orb on the same frame instead
   * of after a round-trip. Local/AI play keeps applying moves directly.
   *
   * Everything that must stay authoritative (snapshots, result UI, history)
   * reads `online.gameState` directly and is untouched by this.
   */
  const boardState: GameState =
    type === 'online' ? online.optimisticState ?? online.gameState ?? state : state;

  // Sync authoritative game state from server
  useEffect(() => {
    if (type === 'online' && online.gameState) {
      setState(online.gameState);
    }
  }, [type, online.gameState]);

  useEffect(() => {
    if (
      type === 'online' &&
      online.lastFinished &&
      online.lastFinished.userId === identity?.userId &&
      state.status === 'IN_PROGRESS'
    ) {
      setFinishModal({ place: online.lastFinished.place });
    }
  }, [type, online.lastFinished, identity?.userId, state.status]);

  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [showGameOver, setShowGameOver] = useState<boolean>(false);
  // Hard-AI victory reward, set only from a live server response. Null while
  // offline or when no badge was earned — the modal renders celebration UI
  // exclusively from this, so offline play can never show an error.
  const [aiReward, setAiReward] = useState<AiWinReward | null>(null);
  const [wallDrag, setWallDrag] = useState<WallDrag | null>(null);
  const wallDragRef = useRef<WallDrag | null>(null);
  // Coalesces touch-move floods (often 100+/sec) into one state commit per
  // animation frame. The ref always holds the latest finger position, so no
  // movement is lost — intermediates are just skipped.
  const dragFrameRef = useRef<number | null>(null);
  const [resignOpen, setResignOpen] = useState<boolean>(false);
  const [finishModal, setFinishModal] = useState<{ place: number } | null>(null);
  // Opponent profile overlay state lives with the other UI state (not next
  // to the tap handler): the hardware-back effect above reads it.
  const [profilePlayer, setProfilePlayer] = useState<{ userId: string; username: string } | null>(null);
  const [rematchSent, setRematchSent] = useState<boolean>(false);
  const [rematchIncomingDismissed, setRematchIncomingDismissed] = useState<boolean>(false);
  // In-match replay: null = live final board; a step number replays the
  // stored history through the existing replay reconstruction (no new page).
  const [viewingStep, setViewingStep] = useState<number | null>(null);
  const [replaying, setReplaying] = useState<boolean>(false);
  // Chess.com-style premove queue (moves + wall pre-drops), auto-played in order.
  type QueuedStep =
    | { kind: 'move'; from: CellCoord; to: CellCoord }
    | { kind: 'wall'; wall: WallCoord };
  const [premoveQueue, setPremoveQueue] = useState<QueuedStep[]>([]);
  const [premoveSel, setPremoveSel] = useState<string | null>(null);
  const executedPremoveRef = useRef('');

  /**
   * New game on the same mounted screen (rematch switch, no remount). The
   * finished board underneath stays visible as the waiting visual, but every
   * finished-state flag from the old game must go: a lingering game-over
   * modal would cover the new match's first seconds, and a stale offline
   * snapshot would resolve seats for the wrong game. Placed after every
   * setter it touches — hooks below must never reach above their own
   * declarations.
   */
  const prevOnlineGameIdRef = useRef(onlineGameId);
  useEffect(() => {
    if (type !== 'online' || prevOnlineGameIdRef.current === onlineGameId) return;
    prevOnlineGameIdRef.current = onlineGameId;
    setShowGameOver(false);
    setFinishModal(null);
    setOfflineSnapshot(null);
    setRematchSent(false);
    setRematchIncomingDismissed(true);
    setViewingStep(null);
    setReplaying(false);
    setPremoveQueue([]);
    setPremoveSel(null);
  }, [type, onlineGameId]);

  const [timers, setTimers] = useState<Record<string, number>>(() => {
    const defaultSec = timeControl.minutes * 60;
    const initialTimers: Record<string, number> = {};
    for (const p of initialState.players) {
      initialTimers[p.id] = defaultSec;
    }
    return initialTimers;
  });

  // Sync clocks from server
  useEffect(() => {
    if (type === 'online' && Object.keys(online.clocks).length > 0) {
      setTimers(online.clocks);
    }
  }, [type, online.clocks]);

  // Thirty-second warning: fires once, the moment YOUR clock crosses 30s
  // going down — not at game start when the control itself is short, and
  // never twice. `timers` are seconds in every mode (server ms are
  // converted on the way in).
  const lastMySecsRef = useRef<number | null>(null);
  const warned30Ref = useRef(false);
  useEffect(() => {
    if (!CLOCK_ENABLED) return;
    if (state.status !== 'IN_PROGRESS') return;
    const myId = online.myPlayerId ?? state.players[humanIdx]?.id ?? null;
    if (!myId) return;
    const mine = timers[myId];
    if (mine == null) return;
    const prev = lastMySecsRef.current;
    lastMySecsRef.current = mine;
    if (!warned30Ref.current && prev != null && prev > 30 && mine <= 30 && mine > 0) {
      warned30Ref.current = true;
      void playThirtySecondsSound();
    }
  }, [timers, state.status, state.players, humanIdx, online.myPlayerId]);

  // Per-move bonus: credited to the mover after every move/wall, in EVERY
  // match and clock. Toggleable from Settings — when off, no bonus at all.
  // The credit flashes on the mover's clock so the jump is legible.
  const [lastBonus, setLastBonus] = useState<{ playerId: string; amount: number } | null>(null);
  // Manual deps are intentional: the callback must refresh when the clock
  // config changes (React Compiler is not enabled in this project, and its
  // inferred deps would freeze stale timeControl/incrementEnabled values).
  const creditIncrement = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    (moverId: string, action: GameAction) => {
      const inc = effectiveIncrement(timeControl, incrementEnabled);
      if (inc <= 0) return;
      if (action.type !== 'MOVE' && action.type !== 'PLACE_WALL') return;
      setTimers((prev) => ({ ...prev, [moverId]: (prev[moverId] ?? 0) + inc }));
      setLastBonus({ playerId: moverId, amount: inc });
    },
    [timeControl, incrementEnabled]
  );

  useEffect(() => {
    if (!lastBonus) return;
    const t = setTimeout(() => setLastBonus(null), 1200);
    return () => clearTimeout(t);
  }, [lastBonus]);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Walking away from a live online game resigns it (server no-ops
  // finished games) so no ghost seat blocks rematch/challenge/queue.
  useEffect(() => {
    if (type !== 'online' || !onlineGameId) return;
    return () => {
      const live = stateRef.current;
      if (live && live.status === 'IN_PROGRESS') {
        try {
          socketManager.getSocket().emit('game:leave', { gameId: onlineGameId });
        } catch {
          // offline — server grace path covers it
        }
      }
    };
  }, [type, onlineGameId]);

  // Action sounds — fire for both player and AI actions.
  // A move onto the goal line gets its own distinct chime, a hop over
  // another orb gets the jump sound, and your moves sound different from
  // everyone else's. Audio is pre-warmed on mount so the first move doesn't
  // pay the native-module + decode cold start inside its tap commit.
  useEffect(() => {
    preloadSounds();
    void playGameStartSound();
  }, []);
  const historyLenRef = useRef(state.history.length);
  // Last-known orb positions, so a jump (a move covering more than one
  // cell) can be told apart from a plain step. Refreshed every run.
  const positionsRef = useRef<Record<string, { row: number; col: number }> | null>(null);
  useEffect(() => {
    if (!positionsRef.current) {
      positionsRef.current = {};
      for (const p of state.players) positionsRef.current[p.id] = { ...p.position };
    }
    const len = state.history.length;
    if (len > historyLenRef.current) {
      const last = state.history[len - 1];
      if (last?.action.type === 'MOVE') {
        const reachedGoal =
          state.status === 'COMPLETED' && state.winnerId !== null;
        if (reachedGoal) {
          void playGoalSound();
        } else {
          // A jump is only certain when exactly one move arrived since the
          // last run; on a multi-move catch-up the stored positions are
          // older than the move, so fall back to a plain step sound.
          const from = positionsRef.current[last.playerId];
          const jumped =
            len === historyLenRef.current + 1 &&
            !!from &&
            Math.abs(from.row - last.action.to.row) + Math.abs(from.col - last.action.to.col) > 1;
          if (jumped) {
            void playJumpSound();
          } else {
            const myId = online.myPlayerId ?? state.players[humanIdx]?.id ?? null;
            if (myId && last.playerId === myId) void playOwnMoveSound();
            else void playOpponentMoveSound();
          }
        }
      } else if (last?.action.type === 'PLACE_WALL') void playWallSound();
    }
    historyLenRef.current = len;
    const next: Record<string, { row: number; col: number }> = {};
    for (const p of state.players) next[p.id] = { ...p.position };
    positionsRef.current = next;
  }, [state.history, state.status, state.winnerId, state.players, humanIdx, online.myPlayerId]);

  // Board geometry for mapping screen touches to wall slots.
  const boardSizeRef = useRef<number>(Math.min(windowWidth - 32, 420));
  // Measured chrome heights so the board takes exactly the leftover space:
  // full width on tall phones, shrunk-to-fit on short ones. No scrolling,
  // no gaps — resign is always visible, nothing overflows.
  const [topH, setTopH] = useState(0);
  const [bottomH, setBottomH] = useState(0);
  const measuredBoardSize = Math.max(
    200,
    Math.floor(Math.min(windowWidth - 24, windowHeight - topH - bottomH - 26))
  );
  const anchorRef = useRef<View>(null);
  const anchorRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const rootRef = useRef<View>(null);
  const rootRectRef = useRef<{ x: number; y: number } | null>(null);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const currentBallColor = playerColor(currentPlayer?.index ?? 0, currentPlayer?.color);
  const onlinePlayerId = online.myPlayerId ?? offlineSnapshot?.myPlayerId ?? null;
  // Prefer the server-confirmed player id over the cached/effectively synced
  // seat index. This keeps green/yellow online seats mapped to the correct
  // starting edge even during the first sync render.
  const onlineSeatIndex =
    type === 'online' && onlinePlayerId
      ? state.players.findIndex((p) => p.id === onlinePlayerId)
      : -1;
  const activeHumanIdx = onlineSeatIndex >= 0 ? onlineSeatIndex : humanIdx;
  // The human side acts only on their own turn. Local pass-and-play is
  // different: after p1 finishes, the device must still be able to move the
  // next active local player (p2/p3/...), even though humanIdx points at p1.
  const inputSeatActive =
    type === 'local' ? currentPlayer?.status === 'ACTIVE' : state.players[activeHumanIdx]?.status === 'ACTIVE';
  const humanTurn =
    state.status === 'IN_PROGRESS' &&
    !isAiThinking &&
    inputSeatActive &&
    (type === 'online'
      ? state.currentPlayerIndex === activeHumanIdx
      : type === 'local' || state.currentPlayerIndex === activeHumanIdx);

  // Premove queueing is offered on the AI's turn: your orb + dots.
  // Master switch in Settings; extended mode adds chaining + wall pre-drops.
  const myOrb = (type === 'ai' || type === 'online') ? state.players[activeHumanIdx] : null;
  const myColor = playerColor(myOrb?.index ?? 0, myOrb?.color);
  const canPremove =
    premoveEnabled &&
    (type === 'ai' || type === 'online') &&
    myOrb?.status === 'ACTIVE' &&
    state.status === 'IN_PROGRESS' &&
    state.currentPlayerIndex !== activeHumanIdx;
  const queueOn = premoveEnabled && extendedQueue;

  // Board perspective, read from the seat's goal direction only. It never
  // moves mid-game, never depends on the pawn's position, and never depends
  // on the locally built layout matching the server's — the three properties
  // that made the old position-based angle flip side seats after their first
  // move. Unknown seat (shouldn't happen) renders unrotated, never crashes.
  const rotationTargetDeg = desiredRotationDeg(
    state.players[activeHumanIdx]?.goalDirection
  );
  // On a 90°/270° board the logical axes run across the screen: a logical-H
  // wall renders screen-vertical. The tray pieces and the finger chip are
  // drawn in screen space, so they render swapped to match — the drag value
  // itself stays logical ('H' means game-H all the way to the server).
  const swapWallVisuals = rotationTargetDeg === 90 || rotationTargetDeg === 270;

  // Destinations show automatically for the player to move.
  // Queueing UI stays visible while a queue exists (even with nothing
  // explicitly selected), so dots never vanish mid-plan. Projected board:
  // dots anchor at your orb, then advance from each queued step's target.
  // Memoized so premove taps and clock ticks don't rebuild these arrays
  // (and therefore the memoized board) when nothing relevant changed.
  const showSel =
    canPremove && myOrb && (premoveSel === myOrb.id || premoveQueue.length > 0);
  const selFrom = useMemo(() => {
    for (let i = premoveQueue.length - 1; i >= 0; i--) {
      const s = premoveQueue[i];
      if (s && s.kind === 'move') return s.to;
    }
    return myOrb?.position ?? null;
  }, [premoveQueue, myOrb]);
  const selHints = useMemo(
    () => (showSel && myOrb && selFrom ? getLegalMovesFrom(state, myOrb.id, selFrom) : EMPTY_CELL_LIST),
    [showSel, myOrb, selFrom, state]
  );
  // Queued targets stay tappable (to extend or cancel) even with dots hidden.
  const queuedTos = useMemo(
    () => premoveQueue.flatMap((s) => (s.kind === 'move' ? [s.to] : [])),
    [premoveQueue]
  );
  const legalMoves = useMemo(
    () =>
      showSel
        ? [...selHints, ...queuedTos]
        : humanTurn && currentPlayer
        ? getLegalMoves(state, currentPlayer.id)
        : EMPTY_CELL_LIST,
    [showSel, selHints, queuedTos, humanTurn, currentPlayer, state]
  );
  // Dots show for the first pick only; afterwards the queue runs blind on
  // tints (own turn always keeps its normal dots).
  // No possibility highlights while queueing — only tapped cells tint.
  const hideDots = canPremove;
  const hintColor = showSel ? myColor : currentBallColor;
  const premoveMarks = useMemo(() => {
    const marks: { to: CellCoord; color: string }[] = [];
    for (const s of premoveQueue) {
      if (s.kind === 'move') marks.push({ to: s.to, color: myColor });
    }
    return marks;
  }, [premoveQueue, myColor]);
  const queuedWallEntries = useMemo(
    () =>
      premoveQueue.flatMap((s, qi) =>
        s.kind === 'wall' ? [{ qi, wall: s.wall, color: myColor }] : []
      ),
    [premoveQueue, myColor]
  );
  // Stable selected-cell object: without this memo the board prop identity
  // changes every render and the memoized board can never skip.
  const selectedCellMemo = useMemo(
    () =>
      showSel && myOrb
        ? { ...myOrb.position }
        : currentPlayer?.position ?? null,
    [showSel, myOrb, currentPlayer]
  );
  const handleMetricsChange = useCallback((bs: number) => {
    boardSizeRef.current = bs;
  }, []);
  // Your walls are always in your tray. On the opponent's turn it goes inert (or
  // accepts queued premoves) — it must never flip to their colour and count,
  // which is what used to happen whenever the turn passed away from you. Local
  // pass-and-play has no fixed seat, so there the tray follows the mover.
  const trayPlayer = type === 'local' ? currentPlayer : myOrb ?? currentPlayer;
  const trayColor = playerColor(trayPlayer?.index ?? 0, trayPlayer?.color);

  const handleQueuedWallPress = useCallback(
    (qi: number) => {
      if (!canPremove) return;
      setPremoveQueue((prev) => prev.filter((_, i) => i !== qi));
    },
    [canPremove]
  );

  /**
   * Revalidate the queue against the live board the moment anything changes
   * (e.g. a wall just landed): simulate steps in order as yourself on a
   * throwaway copy — the real state is never touched. The first step that
   * became impossible drops itself and everything chained after it, so its
   * highlights vanish immediately.
   */
  const pruneQueue = (live: GameState, queue: QueuedStep[]): QueuedStep[] => {
    if (!myOrb || queue.length === 0) return queue;
    const meIdx = live.players.findIndex((p) => p.id === myOrb.id);
    if (meIdx < 0) return [];
    let sim: GameState = {
      ...live,
      players: live.players.map((p) => ({ ...p })),
      walls: [...live.walls],
      currentPlayerIndex: meIdx,
    };
    const out: QueuedStep[] = [];
    for (const s of queue) {
      const action =
        s.kind === 'move'
          ? { type: 'MOVE' as const, to: s.to }
          : { type: 'PLACE_WALL' as const, wall: s.wall };
      const res = applyAction(sim, action);
      if (!res.success) break;
      out.push(s);
      sim = { ...res.state, currentPlayerIndex: meIdx };
    }
    return out;
  };

  useEffect(() => {
    if (premoveQueue.length === 0 || !myOrb) return;
    const pruned = pruneQueue(state, premoveQueue);
    if (pruned.length !== premoveQueue.length) setPremoveQueue(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, premoveQueue]);

  // Clock countdown (offline only; online clocks are server-synchronized).
  // TESTING: CLOCK_ENABLED=false disables the countdown entirely, so no match
  // can be lost on time. See timeControls.ts.
  useEffect(() => {
    if (type === 'online') return;
    if (!CLOCK_ENABLED) return;
    if (state.status !== 'IN_PROGRESS') return;
    const interval = setInterval(() => {
      setTimers((prev) => {
        const activeId = stateRef.current.players[stateRef.current.currentPlayerIndex].id;
        const currentRemaining = prev[activeId] ?? 0;
        if (currentRemaining <= 1) {
          const res = applyAction(stateRef.current, { type: 'TIMEOUT' });
          if (res.success) setState(res.state);
          return { ...prev, [activeId]: 0 };
        }
        return { ...prev, [activeId]: currentRemaining - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.status, type]);

  // AI turn — logic untouched, presentation only.
  // NOTE: isAiThinking is intentionally NOT used as a scheduling guard here:
  // setting it re-renders and would run this effect's cleanup, cancelling
  // the AI timer before it fires (which left the game stuck "thinking").
  useEffect(() => {
    if (
      type !== 'ai' ||
      state.status !== 'IN_PROGRESS' ||
      !isAiSide(state.currentPlayerIndex)
    ) {
      if (isAiThinking) setIsAiThinking(false);
      return;
    }
    setIsAiThinking(true);
    const thinkMs = thinkMsFor(aiDifficulty, testThink);
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const live = stateRef.current;
          if (cancelled || live.status !== 'IN_PROGRESS' || !isAiSide(live.currentPlayerIndex)) return;
          const profile = AI_PROFILES[aiDifficulty];
          // Unbounded deep search off the critical path: time slices yield
          // to the event loop (thinking indicator stays alive), depth is the
          // only ceiling, cancellation keeps the best completed ply.
          const aiAction = await getBestActionAsync(live, profile, undefined, {
            shouldCancel: () => cancelled,
          });
          if (cancelled) return;
          const fresh = stateRef.current;
          // The board may have moved on while we thought (new game,
          // undo... ): only act if it is still the AI's turn.
          if (fresh.status !== 'IN_PROGRESS' || !isAiSide(fresh.currentPlayerIndex)) return;
          if (aiAction) {
            const moverId = fresh.players[fresh.currentPlayerIndex].id;
            const result = applyAction(fresh, aiAction);
            if (result.success) {
              setState(result.state);
              creditIncrement(moverId, aiAction);
            }
          }
        } finally {
          if (!cancelled) setIsAiThinking(false);
        }
      })();
    }, thinkMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, state, aiDifficulty]);

  // Premove execution: exactly ONE attempt per real turn, always against
  // the live board (never a stale projection). Online sends the queued head
  // to the server for authoritative validation; local/AI applies it through
  // the same game-core action path. Invalid heads are discarded cleanly.
  useEffect(() => {
    if (!humanTurn || !currentPlayer) return;
    setPremoveSel(null);
    const key = `${state.gameId}:${state.moveNumber}:${currentPlayer.id}`;
    if (executedPremoveRef.current === key) return;
    executedPremoveRef.current = key;
    const head = premoveQueue[0];
    if (!head) return;
    const action =
      head.kind === 'move'
        ? { type: 'MOVE' as const, to: head.to }
        : { type: 'PLACE_WALL' as const, wall: head.wall };
    if (type === 'online') {
      online.sendAction(action);
      setPremoveQueue((prev) => prev.slice(1));
      return;
    }
    const result = applyAction(state, action);
    if (result.success) {
      setPremoveQueue((prev) => prev.slice(1));
      setState(result.state);
      creditIncrement(currentPlayer.id, action);
    } else {
      setPremoveQueue([]);
    }
  }, [humanTurn, state, premoveQueue, currentPlayer, type, online, creditIncrement]);

  // Game over persistence
  // Rematch toasts auto-dismiss after 4s; the offer itself stays pending on
  // the server, and the result modal's Rematch button can still accept it.
  // Keyed on the offer nonce so a re-sent offer always re-shows the toast.
  useEffect(() => {
    if (type !== 'online' || online.rematchOfferNonce === 0) return;
    setRematchIncomingDismissed(false);
    const t = setTimeout(() => setRematchIncomingDismissed(true), 4000);
    return () => clearTimeout(t);
  }, [type, online.rematchOfferNonce]);

  useEffect(() => {
    if (type !== 'online' || !rematchSent) return;
    const t = setTimeout(() => setRematchSent(false), 4000);
    return () => clearTimeout(t);
  }, [type, rematchSent]);

  useEffect(() => {
    if (type === 'online' && online.rematchGameId && onRematchAccepted) {
      const nextId = online.rematchGameId;
      onRematchAccepted(nextId);
    }
  }, [type, online.rematchGameId, onRematchAccepted]);

  useEffect(() => {
    if (state.status === 'COMPLETED' && !showGameOver) {
      setShowGameOver(true);
      void playGameEndSound();
      setFinishModal(null);
      setPremoveQueue([]);
      setPremoveSel(null);
      const winner = state.players.find((p) => p.id === state.winnerId);
      const record: SavedGameRecord = {
        id: state.gameId,
        date: Date.now(),
        mode: state.mode,
        type,
        aiDifficulty: type === 'ai' ? aiDifficulty : undefined,
        winnerId: state.winnerId,
        winnerName: winner?.displayName ?? 'Nobody',
        // Who "you" are, by seat id. History decides WIN/LOSS from this, so a
        // real display name can never flip a win into a loss again.
        myPlayerId: type === 'ai' ? state.players[humanIdx]?.id ?? null : null,
        totalMoves: state.history.length,
        durationSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
        initialState,
        history: state.history,
      };
      saveGameToHistory(record);
      setAiReward(null);
      // Hard-AI victory reporting: upload the win for badges and analysis, or
      // queue it silently when offline. Celebration appears only from a live
      // server response — never an error, never while offline.
      if (type === 'ai' && aiDifficulty === 'hard' && state.winnerId === state.players[humanIdx]?.id) {
        const payload: SubmitAiWinBody = {
          clientWinId: `aiwin:${state.gameId}`,
          mode: state.mode,
          aiDifficulty: 'hard',
          playerSeat: humanIdx,
          movesNotation: formatGame(state),
          totalPlies: state.history.length,
          durationSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
          playedAt: Date.now(),
        };
        void (async () => {
          const live = await reportHardAiWin(payload);
          const flushed = await flushAiWinQueue();
          const show =
            live && live.newAchievements.length > 0
              ? live
              : flushed.find((r) => r.newAchievements.length > 0) ?? null;
          if (show) setAiReward(show);
        })();
      } else {
        // Not a hard-AI win, but a good moment to drain the outbox quietly.
        void flushAiWinQueue();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const measureAnchor = () => {
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      anchorRectRef.current = { x, y, w, h };
    });
  };

  const measureRoot = () => {
    rootRef.current?.measureInWindow((x, y) => {
      rootRectRef.current = { x, y };
    });
  };

  /** Convert a screen touch point to board-relative coordinates. */
  const toBoardPoint = (
    pageX: number,
    pageY: number
  ): { x: number; y: number; boardSize: number } | null => {
    const rect = anchorRectRef.current;
    if (!rect) return null;
    const boardSize = boardSizeRef.current;
    // Board is centered horizontally inside the full-width anchor.
    const boardLeft = rect.x + (rect.w - boardSize) / 2;
    const boardTop = rect.y;
    let bx = pageX - boardLeft;
    let by = pageY - boardTop;
    // Inverse of the static board rotation for tap/drag mapping.
    if (rotationTargetDeg !== 0) {
      const rad = (-rotationTargetDeg * Math.PI) / 180;
      const cx = boardSize / 2;
      const cy = boardSize / 2;
      const dx = bx - cx;
      const dy = by - cy;
      bx = cx + dx * Math.cos(rad) - dy * Math.sin(rad);
      by = cy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    return { x: bx, y: by, boardSize };
  };

  // Stable identity so the memoized board skips renders where the tap
  // target handling didn't change (e.g. clock ticks).
  const handleCellPress = useCallback(
    (target: CellCoord) => {
    if (state.status !== 'IN_PROGRESS') return;
    // Premove queueing on the AI's turn: own orb selects, a dot appends a
    // step (chained from the last one when extended), tapping a ring drops
    // that step. Strictly your own orb — never the AI's.
    if (canPremove && myOrb) {
      if (target.row === myOrb.position.row && target.col === myOrb.position.col) {
        // One tap undoes everything: a non-empty queue clears outright,
        // otherwise the tap just toggles selection.
        if (premoveQueue.length > 0) {
          setPremoveQueue([]);
          setPremoveSel(null);
        } else {
          setPremoveSel((prev) => (prev === myOrb.id ? null : myOrb.id));
        }
        return;
      }
      if (
        showSel &&
        myOrb &&
        selFrom &&
        selHints.some((m) => m.row === target.row && m.col === target.col)
      ) {
        // Tapping an already-queued step truncates the chain there.
        const dupIdx = premoveQueue.findIndex(
          (s) => s.kind === 'move' && s.to.row === target.row && s.to.col === target.col
        );
        if (dupIdx >= 0) {
          setPremoveQueue((prev) => prev.slice(0, dupIdx));
          return;
        }
        const step = {
          kind: 'move' as const,
          from: { ...selFrom },
          to: target,
        };
        // Chain up to 5 — selection stays so the next tap extends the route.
        setPremoveQueue((prev) => (prev.length >= 5 ? prev : [...prev, step]));
        return;
      }
      const queuedIdx = premoveQueue.findIndex(
        (s) => s.kind === 'move' && s.to.row === target.row && s.to.col === target.col
      );
      if (queuedIdx >= 0) {
        setPremoveQueue((prev) => prev.filter((_, i) => i !== queuedIdx));
      }
      return;
    }
    if (!humanTurn || !currentPlayer) return;
    const action = { type: 'MOVE' as const, to: target };
    if (type === 'online') {
      if (onlineConnStatus !== 'connected') {
        setPremoveQueue((prev) =>
          prev.length >= 5 ? prev : [...prev, { kind: 'move' as const, from: { ...currentPlayer.position }, to: target }]
        );
        return;
      }
      // Optimistic, but only for the move that was actually accepted for
      // sending: the hook applies it to the DERIVED board (never to
      // confirmed state), refuses a second action while one is unconfirmed,
      // and keeps a predicted goal from reading as a finished game. A refusal
      // here means our move is still in flight — the tap is simply dropped
      // rather than queued, because queueing it would replay a stale turn.
      onlineSendAction(action);
      return;
    }
    const result = applyAction(state, action);
    if (result.success) {
      setState(result.state);
      creditIncrement(currentPlayer.id, action);
    }
  }, [
    state,
    canPremove,
    myOrb,
    premoveQueue,
    showSel,
    selFrom,
    selHints,
    humanTurn,
    currentPlayer,
    type,
    onlineConnStatus,
    onlineSendAction,
    creditIncrement,
  ]);

  // --- Wall inventory drag & drop (fixed orientation per piece) ---
  // On your turn the drop places immediately; on the AI's turn (extended
  // queue on) the drop is stored as a wall pre-drop instead.

  const handleTrayStart = (orientation: Orientation, pageX: number, pageY: number) => {
    const owner = humanTurn ? currentPlayer : canPremove && queueOn ? myOrb : null;
    if (!owner || owner.wallsRemaining <= 0) return;
    measureAnchor();
    measureRoot();
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const drag: WallDrag = { orientation, pageX, pageY };
    wallDragRef.current = drag;
    setWallDrag(drag);
  };

  const handleTrayMove = (pageX: number, pageY: number) => {
    const next: WallDrag | null = wallDragRef.current
      ? { ...wallDragRef.current, pageX, pageY }
      : null;
    wallDragRef.current = next;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = requestAnimationFrame(() => {
      dragFrameRef.current = null;
      setWallDrag(wallDragRef.current);
    });
  };

  const handleTrayEnd = (pageX: number, pageY: number) => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const drag = wallDragRef.current;
    wallDragRef.current = null;
    setWallDrag(null);
    if (!drag || state.status !== 'IN_PROGRESS') return;
    // One action in flight (online): a drag-and-drop is a second input the
    // player did not mean as a queued move. Refuse before consuming the
    // gesture so the wall snaps back instead of vanishing into nothing.
    if (type === 'online' && online.inputLocked) {
      void playIllegalMoveSound();
      return;
    }

    const pt = toBoardPoint(pageX, pageY);
    if (!pt) return;
    // Released outside the board → cancel silently.
    if (!isInsideBoard(pt.boardSize, pt.x, pt.y)) return;

    const slot = nearestWallSlot(pt.boardSize, pt.x, pt.y);
    const candidate: WallCoord = {
      row: slot.row,
      col: slot.col,
      orientation: drag.orientation,
    };

    // Pre-drop: queue the wall for your next turn.
    if (!humanTurn) {
      if (!canPremove || !queueOn || !myOrb || myOrb.wallsRemaining <= 0) return;
      if (!isLegalWallPlacement(state, myOrb.id, candidate)) {
        void playIllegalMoveSound();
        return;
      }
      setPremoveQueue((prev) =>
        prev.length >= 5 ? prev : [...prev, { kind: 'wall' as const, wall: candidate }]
      );
      return;
    }
    if (!currentPlayer || currentPlayer.wallsRemaining <= 0) return;
    if (!isLegalWallPlacement(state, currentPlayer.id, candidate)) {
      void playIllegalMoveSound();
      return;
    }

    const action = { type: 'PLACE_WALL' as const, wall: candidate };
    if (type === 'online') {
      if (online.connStatus !== 'connected') {
        setPremoveQueue((prev) =>
          prev.length >= 5 ? prev : [...prev, { kind: 'wall' as const, wall: candidate }]
        );
        return;
      }
      // Same optimistic contract as the move path: the hook refuses a second
      // action while one is unconfirmed, so a fast wall-then-move cannot slip
      // two actions past the server's one-in-flight assumption.
      online.sendAction(action);
      return;
    }
    const result = applyAction(state, action);
    if (result.success) {
      setState(result.state);
      creditIncrement(currentPlayer.id, action);
    } else {
      // Passed the UI legality gate but failed the authoritative rules
      // (same rejected drop, detected a step later).
      void playIllegalMoveSound();
    }
  };

  const handleResign = () => {
    if (state.status !== 'IN_PROGRESS') return;
    if (type === 'online') {
      online.resign();
    } else if (type === 'ai') {
      // Actor matters: resigning mid-AI-think must crown the AI, not you.
      // In multiplayer AI games the match must end right here as your loss:
      // your forfeit cascades through every AI seat (worst remaining
      // places), so no AI keeps playing and the game completes at once.
      const res = forfeitMatch(state, myOrb?.id ?? '', Date.now());
      if (!res.success) return;
      setPremoveQueue([]);
      setPremoveSel(null);
      setState(res.state);
    } else {
      const result = applyAction(
        state,
        { type: 'RESIGN' },
        { timestamp: Date.now(), actorId: undefined }
      );
      if (result.success) setState(result.state);
    }
  };

  const handleRematch = () => {
    if (type === 'online') {
      online.offerRematch();
      setRematchSent(true);
      return;
    }
    setShowGameOver(false);
    setViewingStep(null);
    setReplaying(false);
    setPremoveQueue([]);
    setPremoveSel(null);
    const fresh = createInitialState({
      mode,
      playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, identity?.displayName ?? 'You'),
      wallsEach,
    });
    setState(fresh);
    setInitialState(fresh);
    historyLenRef.current = 0;
    // Fresh clocks — never carry leftover time into the new match.
    const full = timeControl.minutes * 60;
    const reset: Record<string, number> = {};
    for (const p of fresh.players) reset[p.id] = full;
    setTimers(reset);
  };

  // Seat-relative placement: each side keeps its own players for the whole
  // game, so clocks never swap sides. 1v1: one opponent on top, you at the
  // bottom. Multiplayer: two cards above the board, two below — the bottom
  // row is always your seat plus the last opponent, the rest sit on top.
  // You always sit at the bottom on your own phone: the human side in AI
  // games, the first player otherwise. Nobody's clock ever swaps sides.
  const seatIdx = type === 'online' ? activeHumanIdx : type === 'ai' ? humanIdx : 0;

  // My seat + finished state (online): a FINISHED player leaves freely
  // with placement kept; only ACTIVE players resign/forfeit on departure.
  const mySeat = state.players[seatIdx] ?? null;
  const mySeatFinished = type === 'online' && mySeat?.status === 'FINISHED';
  const myAiFinished = type === 'ai' && myOrb?.status === 'FINISHED';
  const isCompleted = state.status === 'COMPLETED';
  const isMultiplayer = state.players.length > 2;
  // Quick reactions: the dock is visible in live online matches AND in 2p
  // AI games; the sending tray is online-only. In AI games the USER sends
  // nothing — the engine taunts through the dock itself (see below), and its
  // taps echo locally with no socket behind them. Local, replay, analysis
  // and finished matches show nothing and attach nothing.
  const socketLive = type === 'online' && !!onlineGameId;
  const matchLive = !isCompleted && !replaying && viewingStep === null;
  // AI matches get the tray for testing in classic 2p, every race mode and
  // every centre mode (the engine's banter stays 2p-only, see below).
  const aiSparring =
    type === 'ai' &&
    (state.mode === '2p' || state.mode.startsWith('race') || state.mode.startsWith('center'));
  const reactionsVisible = (socketLive || aiSparring) && matchLive;
  const reactions = useQuickReactions({
    enabled: reactionsVisible,
    socketLive,
    gameId: onlineGameId ?? '',
    myUserId: identity?.userId ?? null,
  });

  // AI banter (2p AI games only): laugh the first time the engine's race lead
  // reaches a ~70% position, applaud the first time the human's reaches ~80%.
  // Race-implied odds (logistic on the step lead): +1 step ≈ 73%, +2 ≈ 88%.
  // Once per game each, never in the opening (leads flap early), and never
  // laughing while the human is about to convert — taunting on the eve of
  // defeat is a bug, not banter.
  const tauntGameRef = useRef<string | null>(null);
  const laughedRef = useRef(false);
  const clappedRef = useRef(false);
  useEffect(() => {
    if (tauntGameRef.current !== state.gameId) {
      tauntGameRef.current = state.gameId;
      laughedRef.current = false;
      clappedRef.current = false;
    }
    if (type !== 'ai' || state.players.length !== 2) return;
    if (state.status !== 'IN_PROGRESS' || state.history.length < 10) return;
    if (laughedRef.current && clappedRef.current) return;
    const human = state.players[humanIdx];
    const foe = state.players[1 - humanIdx];
    if (!human || !foe) return;
    const board = boardOf(state);
    const myDist = routeOf(state, board, human).distance;
    const aiDist = routeOf(state, board, foe).distance;
    if (!Number.isFinite(myDist) || !Number.isFinite(aiDist)) return;
    if (!laughedRef.current && aiDist + 1 <= myDist && myDist > 2) {
      laughedRef.current = true;
      reactions.preview('laugh');
    } else if (!clappedRef.current && myDist + 2 <= aiDist && aiDist > 2) {
      clappedRef.current = true;
      reactions.preview('clap');
    }
  });
  // Quick reactions: a tap sends (online) and shows its own bubble in the
  // dock floating over the inventory. Nothing is remembered — each bubble
  // deletes itself.
  const handleReactionSend = (kind: ReactionKind) => {
    if (socketLive) reactions.send(kind);
    reactions.echo(kind);
  };

  // No Resign anywhere near a finished match — and never in local games.
  const canResign =
    !isCompleted && type !== 'local' && !mySeatFinished && !myAiFinished;

  // Manual deps are intentional (React Compiler is not enabled; see the
  // note on creditIncrement): back routing must see fresh props.
  const leaveFinishedAndHome = useCallback(
    () => {
    if (type === 'online' && onlineGameId) {
      try {
        socketManager.getSocket().emit('game:leave', { gameId: onlineGameId });
      } catch {
        // offline — nothing to free server-side
      }
    }
    onHome();
  }, [type, onlineGameId, onHome]);

  const handleBackPress = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    () => {
    // Failed join: never seated, so there is nothing to resign — Back frees
    // the dead screen directly. (The join failure itself shows on your card.)
    if (type === 'online' && online.joinError) {
      leaveFinishedAndHome();
      return;
    }
    // Seat never resolved: there is no seat to resign with, so Back must not
    // offer the resign dialog — it frees the unplayable screen directly.
    if (type === 'online' && online.gameState && !online.myPlayerId) {
      leaveFinishedAndHome();
      return;
    }
    if (isCompleted || type === 'local' || myAiFinished) {
      onHome();
      return;
    }
    if (mySeatFinished) {
      leaveFinishedAndHome();
      return;
    }
    setResignOpen(true);
  }, [isCompleted, type, myAiFinished, onHome, mySeatFinished, leaveFinishedAndHome, online.joinError, online.gameState, online.myPlayerId]);

  // ---- In-match replay (finished games only) ----
  // Reconstructs the opening position from the mode + final names, then
  // replays the actual stored moves with the existing replay function.
  const replayBase: GameState | null = useMemo(() => {
    if (!isCompleted) return null;
    if (type === 'local' || type === 'ai') return initialState;
    const anchor = state.players[0];
    const placed = state.history.filter(
      (h) => h.action.type === 'PLACE_WALL' && h.playerId === anchor?.id
    ).length;
    return createInitialState({
      mode: state.mode,
      playerNames: state.players.map((p) => p.displayName),
      wallsEach: (anchor?.wallsRemaining ?? 10) + placed,
    });
  }, [isCompleted, type, initialState, state.mode, state.players, state.history]);
  const totalSteps = state.history.length;
  // Reconstruction can throw if the local history diverged (missed
  // broadcast) — fall back to the live final board instead of crashing.
  const replayState: GameState | null = useMemo(() => {
    if (viewingStep === null || !replayBase) return null;
    try {
      return rebuildStateAtStep(replayBase, state.history, viewingStep);
    } catch {
      return null;
    }
  }, [viewingStep, replayBase, state.history]);
  // Step-through replay always wins (it is an explicit scrub through history).
  // Otherwise online play renders the optimistic board, so an unconfirmed
  // move of ours appears immediately rather than a frame later.
  const displayState = replayState ?? boardState;

  const enterReplay = () => {
    setShowGameOver(false);
    setReplaying(false);
    setViewingStep(totalSteps);
  };

  const exitReplay = useCallback(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    () => {
    setReplaying(false);
    setViewingStep(null);
  }, []);

  // Hardware back: dismiss the topmost overlay first (result modal, resign
  // overlay first (result modal, resign confirm, place modal, incoming
  // rematch toast, step-through replay), then follow the same
  // leave/resign routing. Always handled here while a match screen is
  // mounted, so App's generic pop never fires underneath a game.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (profilePlayer) {
        setProfilePlayer(null);
        return true;
      }
      if (showGameOver) {
        setShowGameOver(false);
        return true;
      }
      if (resignOpen) {
        setResignOpen(false);
        return true;
      }
      if (finishModal) {
        setFinishModal(null);
        return true;
      }
      if (
        type === 'online' &&
        isCompleted &&
        online.rematchOffered &&
        !rematchIncomingDismissed
      ) {
        setRematchIncomingDismissed(true);
        return true;
      }
      if (viewingStep !== null) {
        exitReplay();
        return true;
      }
      if (
        type === 'online' &&
        !online.gameState &&
        !offlineSnapshot
      ) {
        // No board at all yet (join still in flight): back releases the seat
        // and goes home, same as the old Cancel did.
        leaveFinishedAndHome();
        return true;
      }
      handleBackPress();
      return true;
    });
    return () => sub.remove();
  }, [
    profilePlayer,
    showGameOver,
    resignOpen,
    finishModal,
    type,
    isCompleted,
    online.rematchOffered,
    rematchIncomingDismissed,
    viewingStep,
    onlinePlayerId,
    online.gameState,
    offlineSnapshot,
    onHome,
    leaveFinishedAndHome,
    handleBackPress,
    exitReplay,
  ]);

  // Auto-advance playback; at the end, stop on the live final board.
  useEffect(() => {
    if (!replaying || viewingStep === null || viewingStep >= totalSteps) return;
    const t = setTimeout(() => {
      if (viewingStep + 1 >= totalSteps) {
        setReplaying(false);
        setViewingStep(null);
      } else {
        setViewingStep(viewingStep + 1);
      }
    }, 750);
    return () => clearTimeout(t);
  }, [replaying, viewingStep, totalSteps]);

  const topList = state.players.filter((_, i) => i !== seatIdx);
  const activeId = state.players[state.currentPlayerIndex]?.id;
  // 4 seats: top 2 opponents, bottom you + 1 opponent. 3 seats: top 1
  // opponent, bottom you + 1 opponent. 1v1 is untouched (top 1, bottom 1).
  const splitActive = isMultiplayer && topList.length >= 2;
  const bottomCompanions = splitActive ? topList.slice(-1) : [];
  const topOpponents = splitActive ? topList.slice(0, -1) : topList;
  const topStripState: GameState = {
    ...state,
    players: topOpponents,
    currentPlayerIndex: topOpponents.findIndex((p) => p.id === activeId),
  };
  const seatPlayer = state.players[seatIdx];
  const bottomPlayers = [...(seatPlayer ? [seatPlayer] : []), ...bottomCompanions];
  const bottomStripState: GameState | null =
    bottomPlayers.length > 0
      ? {
          ...state,
          players: bottomPlayers,
          currentPlayerIndex: bottomPlayers.findIndex((p) => p.id === activeId),
        }
      : null;

  // Board ratings are shown only when real. There is no client-side source
  // of truth for any seat's rating (AI numbers used to be hardcoded per
  // difficulty and everyone else got a flat 1500), so the board passes no
  /**
 * Per-seat connection/attention state for the player cards. No banners: every
 * one of these used to be a full-width strip above the board.
 *
 * Absence and idling are separate values on purpose: the disconnect window is
 * a real grace countdown the server is honouring, while the inactivity notice
 * is a connected player who has not moved. Both events already carry the seat
 * they belong to, and a seat can only ever be in one of the two — the
 * disconnect handler clears the AFK state and vice versa.
 *
 * The player's OWN transport state lands on their own card the same way: a
 * dropped socket reads "Reconnecting…", a failed join the failure (Back
 * still leaves). Nobody else's card is touched. A move in flight and a
 * rejected move deliberately stay off the card — the board locks while a
 * move is unconfirmed, and a rejection is a sound, not a status.
 *
 * Empty for local/AI play: there is no socket state to report.
 */
const onlineSeatStatus = useMemo<Record<string, SeatStatus>>(() => {
  if (type !== 'online') return {};
  const map: Record<string, SeatStatus> = {};
  // Every away seat gets its own countdown — on a 3P/4P table two seats can
  // be away at once, and each card counts down its own window.
  for (const grace of Object.values(online.opponentGrace)) {
    const seat = grace.playerId ?? null;
    // playerId is always sent for online matches; an entry without one names
    // no card, so it is skipped rather than pinned on the wrong seat.
    if (seat) {
      map[seat] = { kind: 'disconnected', secondsLeft: grace.seconds };
    }
  }
  if (online.afkWarning) {
    const seat = online.afkWarning.playerId ?? online.myPlayerId;
    if (seat) {
      map[seat] = { kind: 'afk', secondsLeft: online.afkWarning.secondsRemaining };
    }
  }
  // Own transport state, on the player's own card only — and only when no
  // server-driven state already owns that seat. Just the two states that
  // need no other UI: a dropped socket and a failed join. (A move in flight
  // and a rejected move stay off the card — the board locks while sending,
  // and a rejection is a sound, not a status.)
  const ownSeat = online.myPlayerId;
  if (ownSeat && !map[ownSeat]) {
    if (online.joinError) {
      map[ownSeat] = { kind: 'rejected', message: online.joinError };
    } else if (online.connStatus === 'reconnecting' || online.connStatus === 'disconnected') {
      map[ownSeat] = { kind: 'reconnecting', pendingCount: online.pendingCount };
    }
  }
  return map;
}, [
  type,
  online.opponentGrace,
  online.afkWarning,
  online.myPlayerId,
  online.joinError,
  online.connStatus,
  online.pendingCount,
]);

// Seat miss: sync arrived but neither your id nor name matches a seat
// (changed identity mid-flow). Never silently play as someone else — the
// seat resolves as soon as the ids line up, and Back frees the screen
// meanwhile (see handleBackPress). Retried on an interval, not once: the
// usual cause is an identity that hydrates a moment after the first sync,
// and one shot would miss the recovery. No banner: there is no seat to hang
// an indicator on until the resync lands.
useEffect(() => {
  if (type !== 'online' || !online.gameState) return;
  if (online.gameState.status !== 'IN_PROGRESS') return;
  if (online.myPlayerId || online.joinError) return;
  online.resync();
  const timer = setInterval(online.resync, 5000);
  return () => clearInterval(timer);
// Manual deps are intentional (React Compiler is not enabled): the whole
// `online` object changes on every clock tick. Scalar deps only, so moves
// and ticks never re-arm this — identity, seat and game identity do.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [type, online.gameState?.gameId, online.gameState?.status, online.myPlayerId, online.joinError, online.resync]);

// A server-rejected move is a sound, not a card status: the board already
// rolled the move back, so the illegal-move click is the whole feedback.
const lastActionErrorNonce = useRef<number | null>(null);
useEffect(() => {
  if (type !== 'online' || !online.actionError) return;
  if (lastActionErrorNonce.current === online.actionError.nonce) return;
  lastActionErrorNonce.current = online.actionError.nonce;
  void playIllegalMoveSound();
}, [type, online.actionError]);

// A newly earned achievement is a toast with its medal + the notify sound —
// never content inside the Win modal. Fires once per reward: aiReward
// persists while the result is on screen, so the key guards the re-fire.
// Deferred past the Win modal (a native modal renders above the app-level
// toast): if the result is still up when the reward lands, the toast waits
// for the dismiss and celebrates over the finished board instead.
const lastRewardToastKey = useRef<string | null>(null);
useEffect(() => {
  const first = aiReward?.newAchievements?.[0];
  if (!first || !aiReward) return;
  const key = `${aiReward.win.id}:${first.code}`;
  if (lastRewardToastKey.current === key) return;
  if (showGameOver) return;
  lastRewardToastKey.current = key;
  void playNotifySound();
  toast.show(
    `New Achievement — ${first.name}`,
    undefined,
    <AchievementMedal icon={first.icon} tier={first.tier} size={30} />
  );
}, [aiReward, showGameOver]);

// ratings at all and PlayerStrip hides the pills instead of showing fiction.

  // A board seat id ('p2') is not a user id. The server sends the seat ->
  // account map with every sync, so this is the one lookup that turns a
  // tapped opponent into the exact same userId the profile screen, history
  // and the leaderboard use. No account behind the seat (AI, local, own
  // seat) means no profile, and the chip stays inert.
  const opponentAccount = useCallback(
    (playerId: string): { userId: string; username: string } | null => {
      const userId = online.playerUserIds[playerId];
      const player = state.players.find((p) => p.id === playerId);
      if (!userId || !player) return null;
      return { userId, username: player.displayName };
    },
    [online.playerUserIds, state.players]
  );

  // Opponent profile opens as an overlay ON TOP of the match — never as a
  // navigation. Leaving this screen mid-match emits game:leave and forfeits
  // the live game, which is exactly what the old banner tap did.
  // (State lives near the other UI state above for the back handler.)

  // Only opponents are wired up: your own card opens nothing.
  const handleOpponentPress = useCallback(
    (playerId: string) => {
      const account = opponentAccount(playerId);
      if (account) setProfilePlayer(account);
    },
    // setProfilePlayer is a stable setter; listing it keeps the manual
    // memoization exactly matching what the callback closes over.
    [opponentAccount, setProfilePlayer]
  );

  // Bottom grid shares the row with one opponent: that seat stays tappable
  // while your own card stays inert, exactly like the old bottom strip.
  const handleBottomGridPress = useCallback(
    (playerId: string) => {
      if (playerId === seatPlayer?.id) return;
      handleOpponentPress(playerId);
    },
    [seatPlayer?.id, handleOpponentPress]
  );

  // 1v1 result modal names a single opponent; multiplayer has no one opponent.
  const opponentSeatId = !isMultiplayer ? topList[0]?.id ?? null : null;
  const opponentAccountForResult = opponentSeatId ? opponentAccount(opponentSeatId) : null;

  // Board-relative drag position for the ghost preview, reduced to a
  // snapped-slot STRING key. The raw computation below is trivial (rect
  // reads + a 64-cell scan), but the key is value-compared: same-slot
  // pointer motion keeps the memoized board — and its BFS legality
  // check — asleep instead of rebuilding ~300 views per touch event.
  let dragSlotRaw: WallCoord | null = null;
  if (wallDrag) {
    const pt = toBoardPoint(wallDrag.pageX, wallDrag.pageY);
    if (pt && isInsideBoard(pt.boardSize, pt.x, pt.y)) {
      const s = nearestWallSlot(pt.boardSize, pt.x, pt.y);
      dragSlotRaw = { row: s.row, col: s.col, orientation: wallDrag.orientation };
    }
  }
  const dragSlotKey = dragSlotRaw
    ? `${dragSlotRaw.row},${dragSlotRaw.col},${dragSlotRaw.orientation}`
    : '';
  const dragSlot = useMemo((): WallCoord | null => {
    if (!dragSlotKey) return null;
    const [row, col, orientation] = dragSlotKey.split(',');
    return {
      row: Number(row),
      col: Number(col),
      orientation: orientation as Orientation,
    };
  }, [dragSlotKey]);

  // Legality for the held wall, computed here and published through context so
  // only the small ghost view re-renders when the snapped slot changes.
  // Passing it to GameBoard as a prop re-rendered ~300 views per slot crossing,
  // which capped dragging a held wall across the board at ~15fps while dragging
  // outside it — where no slot is produced — stayed smooth.
  const dragGhostValue = useMemo(() => {
    if (!dragSlot || !currentPlayer) {
      return { slot: null, legal: false, color: trayColor };
    }
    return {
      slot: dragSlot,
      legal: isLegalWallPlacement(displayState, currentPlayer.id, dragSlot),
      color: wallPreviewColor(trayColor),
    };
  }, [dragSlot, currentPlayer, displayState, trayColor]);

  // Screen overlay chip so the held wall follows the finger continuously.
  // Matches the (responsive) tray piece size — and the board's rotation: on
  // a 90°/270° board a logical-H wall renders screen-vertical, so the chip
  // swaps aspect with it. Otherwise the chip shows one shape while the ghost
  // and the placed wall show the other.
  let chipStyle: { left: number; top: number; width: number; height: number } | null = null;
  if (wallDrag && rootRectRef.current) {
    const trayScale = Math.max(0.72, Math.min(1, windowWidth / 390));
    const isH = (wallDrag.orientation === 'H') !== swapWallVisuals;
    const w = (isH ? 56 : 12) * trayScale;
    const h = (isH ? 12 : 56) * trayScale;
    chipStyle = {
      left: wallDrag.pageX - rootRectRef.current.x - w / 2,
      top: wallDrag.pageY - rootRectRef.current.y - h / 2,
      width: w,
      height: h,
    };
  }

  // No connecting page exists on this screen anymore: every entry is gated
  // pre-navigation and arrives with the board (or, for a rematch switch,
  // keeps the finished board visible). Degraded states never take banner
  // space — they show on the affected player's card (see onlineSeatStatus),
  // and a definitively rejected join still leaves through Back.

  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={measureRoot}
      // No inset padding here: App.tsx already wraps every screen in one
      // SafeAreaView (top + bottom), so adding it again would double the gap.
      style={styles.container}
    >
      {/* White status strip on Android so the header truly reaches the top. */}
      <StatusBar barStyle="dark-content" backgroundColor={THEME.colors.backgroundCard} />

      {/* Measured top chrome (header + opponent cards) for board sizing.
          Back in the bar: it resigns an active match, frees a finished seat,
          or closes a finished/local one. Safe area is owned by the app-level
          SafeAreaView, so this bar sits directly under it like every other
          page's. */}
      <View
        style={styles.topChrome}
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          setTopH((prev) => (Math.abs(prev - height) > 1 ? height : prev));
        }}
      >
      {/* Stitch header: white bar reaching the screen top. Back resigns an
          active match, frees a finished seat, or closes a finished/local one. */}
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
          >
            <Feather name="chevron-left" size={24} color={THEME.colors.slate[700]} />
          </TouchableOpacity>
        </View>
      </View>
      {/* Opponent card(s). Turn ring + timer highlight show whose move it is. */}
      {/* Strips ignore touches while a wall is dragged over them. */}
      {/* Multiplayer splits 2 up / 2 down in a grid; 1v1 keeps full cards. */}
      {/* Their reaction dock floats over the card, out of layout. */}
      <View style={styles.sideWrap}>
      {reactionsVisible && (
        <ReactionDock items={reactions.incoming} side="top" onDone={reactions.dismiss} />
      )}
      <View
        pointerEvents={wallDrag ? 'none' : 'auto'}
        style={[
          styles.topStripWrap,
          isMultiplayer ? { width: measuredBoardSize, alignSelf: 'center' } : null,
        ]}
      >
        <PlayerStrip
state={topStripState}
            timers={timers}
            compact
            grid={splitActive}
            bonus={lastBonus}
            seatStatus={onlineSeatStatus}
            onPressPlayer={handleOpponentPress}
          />
      </View>
      </View>
      </View>

      {/* Board + bottom packed with zero gaps, sized to fit the screen. */}
      <View style={styles.boardWrap}>
        <View
          ref={anchorRef}
          collapsable={false}
          onLayout={measureAnchor}
          style={styles.boardAnchor}
        >
          <Animated.View
            key={`board-perspective-${activeHumanIdx}`}
            collapsable={false}
            style={{
              transform: [{ rotate: `${rotationTargetDeg}deg` }],
            }}
          >
          <WallDragGhostProvider value={dragGhostValue}>
            <GameBoard
            state={displayState}
            legalMoves={viewingStep !== null ? EMPTY_CELL_LIST : legalMoves}
            previewWall={null}
            selectedCell={viewingStep !== null ? null : selectedCellMemo}
            // `inputLocked` closes the board for the frame between sending a move and
            // the server confirming it. Without it a second tap in that window
            // submits a move for a turn the server has not handed over.
            interactive={
              (humanTurn || canPremove) &&
              !wallDrag &&
              viewingStep === null &&
              !(type === 'online' && online.inputLocked)
            }
            moveHintColor={wallDrag ? trayColor : hintColor}            premoveMarks={viewingStep !== null ? EMPTY_PREMOVE_MARKS : premoveMarks}
            hideDots={hideDots}
            queuedWalls={viewingStep !== null ? EMPTY_QUEUED_WALLS : queuedWallEntries}
            onQueuedWallPress={canPremove && viewingStep === null ? handleQueuedWallPress : undefined}
            size={measuredBoardSize}
            rotationDeg={rotationTargetDeg}
            onCellPress={viewingStep !== null ? undefined : handleCellPress}
            onMetricsChange={handleMetricsChange}
          />
          </WallDragGhostProvider>
          </Animated.View>
        </View>

        {/* Bottom: your card + wall inventory + resign — packed right under
            the board like the Stitch page, no stretched gaps. */}
        <View
          style={styles.bottomBar}
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout;
            setBottomH((prev) => (Math.abs(prev - height) > 1 ? height : prev));
          }}
        >
          {bottomStripState && (
            <View pointerEvents={wallDrag ? 'none' : 'auto'}>
              <PlayerStrip
                state={bottomStripState}
                timers={timers}
                bonus={lastBonus}
                hideWallsBadge={!splitActive}
                grid={splitActive}
                hideWallsForPlayerId={splitActive ? seatPlayer?.id : undefined}
                seatStatus={onlineSeatStatus}
                onPressPlayer={splitActive ? handleBottomGridPress : undefined}
              />
            </View>
          )}
          {/* Fixed slot: the inventory stays visible every turn (inert off-turn). */}
          {!isCompleted && (
            <View style={styles.traySlot}>
              {/* Your reaction bubbles float over the inventory — never over the board. */}
              {reactionsVisible && (
                <ReactionDock
                  items={reactions.outgoing}
                  side="bottom"
                  onDone={reactions.dismissOutgoing}
                />
              )}
              {trayPlayer && (
              <WallTray
                color={trayColor}
                count={trayPlayer.wallsRemaining}
                held={wallDrag?.orientation ?? null}
                disabled={!(humanTurn || (canPremove && queueOn))}
                swapVisuals={swapWallVisuals}
                onDragStart={handleTrayStart}
                onDragMove={handleTrayMove}
                onDragEnd={handleTrayEnd}
              />
              )}
            </View>
          )}
          {/* Quick-reaction sending row sits directly under the inventory,
              above Resign — live online + 2p AI sparring. A tap sends (online)
              and flies its emoji out of the button into the bubble above your
              card. AI games have no socket, so the fly-and-land is the whole
              effect there. */}
          {(socketLive || aiSparring) && matchLive && (
            <ReactionTray onSend={handleReactionSend} />
          )}
          {/* Finished match: replay controls step through the stored moves
              on this same board — no separate replay page. */}
          {isCompleted && !showGameOver && (
            <View style={styles.replayBar}>
              <View style={styles.replayRow}>
                <TouchableOpacity
                  style={[styles.replayBtn, (viewingStep ?? totalSteps) <= 0 && styles.replayBtnDisabled]}
                  disabled={(viewingStep ?? totalSteps) <= 0}
                  onPress={() => {
                    setReplaying(false);
                    setViewingStep(0);
                  }}
                  accessibilityLabel="First move"
                >
                  <Feather name="chevrons-left" size={18} color={THEME.colors.slate[700]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.replayBtn, (viewingStep ?? totalSteps) <= 0 && styles.replayBtnDisabled]}
                  disabled={(viewingStep ?? totalSteps) <= 0}
                  onPress={() => {
                    setReplaying(false);
                    setViewingStep((s) => Math.max(0, (s ?? totalSteps) - 1));
                  }}
                  accessibilityLabel="Previous move"
                >
                  <Feather name="chevron-left" size={18} color={THEME.colors.slate[700]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.replayBtn}
                  onPress={() => {
                    if (replaying) {
                      setReplaying(false);
                    } else if ((viewingStep ?? totalSteps) >= totalSteps) {
                      setViewingStep(0);
                      setReplaying(true);
                    } else {
                      setReplaying(true);
                    }
                  }}
                  accessibilityLabel={replaying ? 'Pause replay' : 'Play replay'}
                >
                  <Feather name={replaying ? 'pause' : 'play'} size={18} color={THEME.colors.slate[700]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.replayBtn, (viewingStep ?? totalSteps) >= totalSteps && styles.replayBtnDisabled]}
                  disabled={(viewingStep ?? totalSteps) >= totalSteps}
                  onPress={() => {
                    setReplaying(false);
                    setViewingStep((s) => Math.min(totalSteps, (s ?? totalSteps) + 1));
                  }}
                  accessibilityLabel="Next move"
                >
                  <Feather name="chevron-right" size={18} color={THEME.colors.slate[700]} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.replayBtn, (viewingStep ?? totalSteps) >= totalSteps && styles.replayBtnDisabled]}
                  disabled={(viewingStep ?? totalSteps) >= totalSteps}
                  onPress={() => {
                    setReplaying(false);
                    setViewingStep(totalSteps);
                  }}
                  accessibilityLabel="Last move"
                >
                  <Feather name="chevrons-right" size={18} color={THEME.colors.slate[700]} />
                </TouchableOpacity>
                <Text style={styles.replayStep}>
                  {(viewingStep ?? totalSteps)} / {totalSteps}
                </Text>
              </View>
              {viewingStep !== null && (
                <TouchableOpacity style={styles.replayLive} onPress={exitReplay}>
                  <Text style={styles.replayLiveText}>Back to final board</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {!isCompleted && canResign && (
            <View style={styles.resignRow}>
              <TouchableOpacity
                style={styles.resignButton}
                onPress={() => setResignOpen(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Resign game"
              >
                <Feather name="flag" size={17} color={THEME.colors.textSecondaryStrong} />
                <Text style={styles.resignText}>Resign game</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isCompleted && !canResign && type === 'online' && mySeatFinished && (
            <View style={styles.resignRow}>
              <TouchableOpacity
                style={styles.resignButton}
                onPress={leaveFinishedAndHome}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Leave match"
              >
                <Feather name="log-out" size={17} color={THEME.colors.textSecondaryStrong} />
                <Text style={styles.resignText}>Leave match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Stitch resign confirm: dimmed overlay, white card, red icon. */}
      <Modal visible={resignOpen} transparent animationType="fade">
        <SafeAreaView style={styles.resignOverlay} edges={['top', 'bottom']}>
          <View style={styles.resignCard}>
            <View style={styles.resignIconCircle}>
              <Feather name="flag" size={28} color={THEME.colors.error} />
            </View>
            <Text style={styles.resignTitle}>Resign Match?</Text>
            <Text style={styles.resignDesc}>
              {type === 'online'
                ? 'Are you sure you want to resign? This will count as a loss and your rating will decrease.'
                : 'Are you sure you want to resign? This will count as a loss.'}
            </Text>
            <View style={styles.resignActions}>
              <TouchableOpacity
                style={styles.resignConfirm}
                onPress={() => {
                  setResignOpen(false);
                  handleResign();
                }}
              >
                <Text style={styles.resignConfirmText}>Yes, Resign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resignCancel}
                onPress={() => setResignOpen(false)}
              >
                <Text style={styles.resignCancelText}>Keep Playing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Held wall follows the finger */}
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
              borderRadius: Math.min(chipStyle.width, chipStyle.height) / 2,
              backgroundColor: trayColor,
            },
          ]}
        />
      )}

      <Modal visible={finishModal !== null} transparent animationType="fade">
        <SafeAreaView style={styles.resignOverlay} edges={['top', 'bottom']}>
          <View style={styles.finishCard}>
            <View style={styles.finishIconCircle}>
              <Feather name="award" size={30} color={THEME.colors.assessmentInaccuracy} />
            </View>
            <Text style={styles.finishTitle}>
              {finishModal?.place === 1 ? '1st Place' : `${finishModal?.place ?? ''} Place`}
            </Text>
            <Text style={styles.finishDesc}>
              Match continues. Your final rating change appears after the full result is finalized.
            </Text>
            <TouchableOpacity style={styles.finishPrimary} onPress={() => setFinishModal(null)}>
              <Text style={styles.finishPrimaryText}>Keep Watching</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishSecondary} onPress={leaveFinishedAndHome}>
              <Text style={styles.finishSecondaryText}>Leave Match</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <GameOverModal
        visible={showGameOver}
        state={state}
        ratingDelta={type === 'online' && identity ? online.gameEndedResult?.ratingChanges?.[identity.userId]?.delta : undefined}
        ratingAfter={type === 'online' && identity ? online.gameEndedResult?.ratingChanges?.[identity.userId]?.after : undefined}
        opponentName={
          isMultiplayer
            ? undefined
            : type === 'ai'
            ? `AI - ${aiDifficulty.charAt(0).toUpperCase()}${aiDifficulty.slice(1)}`
            : topList[0]?.displayName || 'Opponent'
        }
        isWinner={
          state.winnerId
            ? (type === 'online'
                ? state.winnerId === online.myPlayerId
                : state.winnerId === state.players[humanIdx]?.id)
            : false
        }
        myPlayerId={
          type === 'online'
            ? online.myPlayerId
            : type === 'ai'
            ? state.players[humanIdx]?.id ?? null
            : null
        }
        onRematch={handleRematch}
        showNewGame={type === 'online' && onlineSource !== 'room'}
        onNewGame={() => {
          setShowGameOver(false);
          onNewGame();
        }}
        onReplay={enterReplay}
        opponentUserId={opponentAccountForResult?.userId ?? null}
        onViewOpponentProfile={
          opponentAccountForResult
            ? () => {
                setShowGameOver(false);
                setProfilePlayer(opponentAccountForResult);
              }
            : undefined
        }
        onAnalyze={() => {
          setShowGameOver(false);
          onAnalyze(initialState, state.history, seatIdx);
        }}
        onHome={() => {
          setShowGameOver(false);
          onHome();
        }}
        onClose={() => setShowGameOver(false)}
      />

      {/* Rematch toast rendered as its own Modal so it floats above the
          win/lose result modal, anchored to the bottom like the room invite. */}
      <Modal
        visible={
          type === 'online' &&
          state.status === 'COMPLETED' &&
          ((online.rematchOffered && !rematchIncomingDismissed) || rematchSent)
        }        transparent
        animationType="none"
      >
        <SafeAreaView style={styles.rematchToastOverlay} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.rematchToast}>
            <Feather name="rotate-ccw" size={18} color={THEME.colors.primary} />
            <Text style={styles.rematchToastText}>
              {online.rematchOffered && !rematchIncomingDismissed
                ? 'Opponent wants a rematch'
                : 'Waiting for opponent…'}
            </Text>
            {online.rematchOffered && !rematchIncomingDismissed && (
              <>
                <TouchableOpacity
                  style={styles.rematchDeclineBtn}
                  onPress={() => setRematchIncomingDismissed(true)}
                >
                  <Text style={styles.rematchDeclineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rematchAcceptBtn}
                  onPress={() => {
                    setRematchIncomingDismissed(true);
                    handleRematch();
                  }}
                >
                  <Text style={styles.rematchAcceptText}>Accept</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Opponent profile as an overlay, NOT a navigation: this screen must
          stay mounted or the walk-away cleanup forfeits the live game. In
          inGame mode the profile hides Challenge and replay entries, so
          nothing here can navigate away; hardware back closes it first. */}
      {profilePlayer && (
        <View style={styles.profileOverlay}>
          <PlayerProfileScreen
            userId={profilePlayer.userId}
            initialUsername={profilePlayer.username}
            onBack={() => setProfilePlayer(null)}
            onChallenge={() => {}}
            onSelectGame={() => {}}
            inGame
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.drawBg,
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
    // No text selection anywhere while dragging walls around the board.
    userSelect: 'none',
  },
  // Same bar every other page uses: 56 tall, 16 of horizontal padding, the
  // lowest surface with a container hairline under it.
  header: {
    height: 56,
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
    marginHorizontal: -12,
    paddingHorizontal: 16,
  },
  headerInner: {
    // Touch target stays ≥44 via the button's hitSlop.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topChrome: {
    // No inset padding here: the app-level SafeAreaView owns the safe area.
  },
  topStripWrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  // Anchors the opponent's floating reaction dock to their card.
  sideWrap: {
    position: 'relative',
  },
  boardWrap: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  boardAnchor: {
    width: '100%',
    alignItems: 'center',
  },
  bottomBar: {
    alignItems: 'stretch',
    gap: 10,
    marginTop: 10,
  },
  traySlot: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    // Anchor for the floating reaction dock.
    position: 'relative',
  },
  resignRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingBottom: 8,
  },
  resignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  resignText: {
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textSecondaryStrong,
    fontSize: 12,
    fontWeight: '500',
  },
  resignOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  resignCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    padding: 24,
    maxWidth: 320,
    width: '100%',
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  resignIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: THEME.colors.dangerLight,
    borderWidth: 1,
    borderColor: THEME.colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  finishCard: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    ...THEME.shadows.modal,
  },
  finishIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: THEME.colors.warningLight,
    borderWidth: 1,
    borderColor: THEME.colors.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  finishTitle: {
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.inverseLabel,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  finishDesc: {
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textSecondaryStrong,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  finishPrimary: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
  },
  finishPrimaryText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  finishSecondary: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  finishSecondaryText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondaryStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  resignTitle: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.inverseLabel,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  resignDesc: {
    fontFamily: THEME.fonts.regular,
    color: THEME.colors.textSecondaryStrong,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  resignActions: {
    width: '100%',
    gap: 8,
  },
  resignConfirm: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: THEME.colors.dangerBright,
    alignItems: 'center',
  },
  resignConfirmText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  resignCancel: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resignCancelText: {
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textOnMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  replayBar: {
    width: '100%',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
    ...THEME.shadows.card,
  },
  replayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  replayBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  replayBtnDisabled: {
    opacity: 0.35,
  },
  replayStep: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.slate[700],
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
    minWidth: 52,
    textAlign: 'center',
  },
  replayLive: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  replayLiveText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondaryStrong,
  },
  disabled: {
    opacity: 0.4,
  },
  dragChip: {
    position: 'absolute',
    zIndex: 50,
    transform: [{ scale: 1.06 }],
    ...THEME.shadows.wall,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  rematchToastOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 28,
  },
  profileOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.background,
  },
  rematchToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.colors.surfacePrimaryTintBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...THEME.shadows.card,
  },
  rematchToastText: { flex: 1, fontFamily: THEME.fonts.semiBold, fontSize: 13, color: THEME.colors.inverseLabel },
  rematchDeclineBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: THEME.colors.surfaceMuted },
  rematchDeclineText: { fontFamily: THEME.fonts.semiBold, fontSize: 12, color: THEME.colors.textSecondaryStrong },
  rematchAcceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: THEME.colors.primary },
  rematchAcceptText: { fontFamily: THEME.fonts.bold, fontSize: 12, color: THEME.colors.onPrimary },
});
