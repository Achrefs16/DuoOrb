import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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
  createInitialState,
  forfeitMatch,
  getBestAction,
  getLegalMoves,
  getLegalMovesFrom,
  isLegalWallPlacement,
  playerCountForMode,
  rebuildStateAtStep,
} from '@duoorb/game-core';
import { Feather } from '@expo/vector-icons';
import { GameBoard, isInsideBoard, nearestWallSlot } from '../components/GameBoard';
import { PlayerStrip } from '../components/GameHud';
import { GameOverModal } from '../components/GameOverModal';
import { SideChoice } from './MatchSetupScreen';
import { WallTray } from '../components/WallTray';
import { playGoalSound, playMoveSound, playWallSound, preloadSounds } from '../audio/sounds';
import { SavedGameRecord, loadOnlineGameSnapshot, saveGameToHistory, saveOnlineGameSnapshot } from '../storage/gameStorage';
import { THEME, playerColor } from '../theme';
import { DEFAULT_TIME_CONTROL, TimeControl, effectiveIncrement } from '../timeControls';
import { useOnlineGame } from '../network/useOnlineGame';
import { getCurrentUser } from '../network/auth';
import { socketManager } from '../network/socket';

interface GameScreenProps {
  mode: GameMode;
  type: 'local' | 'ai' | 'online';
  onlineGameId?: string;
  onlineSource?: 'quick' | 'custom' | 'room';
  aiDifficulty?: AIDifficulty;
  timeControl?: TimeControl;
  incrementEnabled?: boolean;
  autoFlip?: boolean;
  premoveEnabled?: boolean;
  extendedQueue?: boolean;
  testThink?: boolean;
  sideChoice?: SideChoice;
  onHome: () => void;
  onNewGame: () => void;
  onRematchAccepted?: (newGameId: string) => void;
  onAnalyze: (initialState: GameState, history: any[], perspectiveIdx: number) => void;
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
      return 700;
    case 'hard':
      return 2200;
    case 'normal':
    default:
      return 1400;
  }
}

function desiredRotationDeg(
  mode: GameMode,
  type: 'local' | 'ai' | 'online',
  seatIdx: number,
  currentPlayerIndex: number,
  autoFlip: boolean,
  startPosition?: CellCoord
): number {
  if (type === 'local') {
    return mode === '2p' && autoFlip && currentPlayerIndex === 1 ? 180 : 0;
  }
  // Derive perspective from the seat's actual starting edge, not from a
  // mode-specific table: bottom=0°, top=180°, left=270°, right=90°.
  // This covers Blue/Red/Green/Yellow Rush Center seats and Race seats
  // (Race starts on the bottom row, so it correctly stays at 0°).
  if (!startPosition) return 0;
  if (startPosition.row === 8) return 0;
  if (startPosition.row === 0) return 180;
  if (startPosition.col === 0) return 270;
  if (startPosition.col === 8) return 90;
  return 0;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  mode,
  type,
  onlineGameId,
  onlineSource = 'quick',
  aiDifficulty = 'normal',
  timeControl = DEFAULT_TIME_CONTROL,
  incrementEnabled = true,
  autoFlip = false,
  premoveEnabled = true,
  extendedQueue = true,
  testThink = false,
  sideChoice = 'blue',
  wallsEach,
  onHome,
  onNewGame,
  onRematchAccepted,
  onAnalyze,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const currentUser = getCurrentUser();

  const online = useOnlineGame({
    gameId: onlineGameId || '',
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
  const [initialState] = useState<GameState>(() =>
    createInitialState({ mode, playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, currentUser.displayName), wallsEach })
  );
  // Static board orientation. Online/AI never animate a flip: the board
  // initializes directly in the player's perspective after the server seat
  // is known. Local 1v1 keeps the existing pass-and-play flip.
  const initialRotationDeg = desiredRotationDeg(
    mode,
    type,
    humanIdx,
    initialState.currentPlayerIndex,
    autoFlip,
    initialState.players[humanIdx]?.position
  );
  const flipAnim = useRef(new Animated.Value(initialRotationDeg === 180 ? 1 : 0)).current;
  const flipTargetRef = useRef(initialRotationDeg === 180 ? 1 : 0);

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
  useEffect(() => {
    if (type === 'online' && onlineGameId && online.gameState) {
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
      online.lastFinished.userId === currentUser.userId &&
      state.status === 'IN_PROGRESS'
    ) {
      setFinishModal({ place: online.lastFinished.place });
    }
  }, [type, online.lastFinished, currentUser.userId, state.status]);

  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [showGameOver, setShowGameOver] = useState<boolean>(false);
  const [wallDrag, setWallDrag] = useState<WallDrag | null>(null);
  const wallDragRef = useRef<WallDrag | null>(null);
  // Coalesces touch-move floods (often 100+/sec) into one state commit per
  // animation frame. The ref always holds the latest finger position, so no
  // movement is lost — intermediates are just skipped.
  const dragFrameRef = useRef<number | null>(null);
  const [resignOpen, setResignOpen] = useState<boolean>(false);
  const [finishModal, setFinishModal] = useState<{ place: number } | null>(null);
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
  // A move onto the goal line gets its own distinct chime.
  // Audio is pre-warmed on mount so the first move doesn't pay the
  // native-module + WAV-decode cold start inside its tap commit.
  useEffect(() => {
    preloadSounds();
  }, []);
  const historyLenRef = useRef(state.history.length);
  useEffect(() => {
    const len = state.history.length;
    if (len > historyLenRef.current) {
      const last = state.history[len - 1];
      if (last?.action.type === 'MOVE') {
        const reachedGoal =
          state.status === 'COMPLETED' && state.winnerId !== null;
        if (reachedGoal) void playGoalSound();
        else void playMoveSound();
      } else if (last?.action.type === 'PLACE_WALL') void playWallSound();
    }
    historyLenRef.current = len;
  }, [state.history, state.status, state.winnerId]);

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

  // Pass-and-play flip: local 1v1 animates between sides. Online/AI
  // perspective changes are direct, stable setValue assignments.
  const rotationTargetDeg = desiredRotationDeg(
    mode,
    type,
    activeHumanIdx,
    state.currentPlayerIndex,
    autoFlip,
    initialState.players[activeHumanIdx]?.position ?? state.players[activeHumanIdx]?.position
  );
  const [flipping, setFlipping] = useState(false);
  useEffect(() => {
    const animateLocalFlip = type === 'local' && mode === '2p' && autoFlip;
    const target = rotationTargetDeg === 180 ? 1 : 0;
    if (!animateLocalFlip) {
      flipTargetRef.current = target;
      flipAnim.setValue(target);
      setFlipping(false);
      return;
    }
    if (flipTargetRef.current === target) return;
    flipTargetRef.current = target;
    setFlipping(true);
    const anim = Animated.timing(flipAnim, {
      toValue: target,
      duration: 350,
      useNativeDriver: true,
    });
    anim.start(() => setFlipping(false));
    return () => anim.stop();
  }, [rotationTargetDeg, type, mode, autoFlip, flipAnim]);

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
  // Tray shows your pieces while queueing on the AI's turn, else the side to move.
  const trayPlayer = humanTurn
    ? currentPlayer
    : canPremove
    ? queueOn
      ? myOrb
      : currentPlayer
    : currentPlayer;
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

  // Clock countdown (offline only; online clocks are server-synchronized)
  useEffect(() => {
    if (type === 'online') return;
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
    const timer = setTimeout(() => {
      try {
        const live = stateRef.current;
        if (live.status !== 'IN_PROGRESS' || !isAiSide(live.currentPlayerIndex)) return;
        const profile = AI_PROFILES[aiDifficulty];
        const aiAction = getBestAction(live, profile);
        if (aiAction) {
          const moverId = live.players[live.currentPlayerIndex].id;
          const result = applyAction(live, aiAction);
          if (result.success) {
            setState(result.state);
            creditIncrement(moverId, aiAction);
          }
        }
      } finally {
        setIsAiThinking(false);
      }
    }, thinkMs);
    return () => clearTimeout(timer);
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
        totalMoves: state.history.length,
        durationSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
        initialState,
        history: state.history,
      };
      saveGameToHistory(record);
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
      // Server-authoritative online play: send only. The local state must
      // not apply the move optimistically, or a goal move can look like the
      // mover already occupies/finished the goal before the server echo.
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
      if (!isLegalWallPlacement(state, myOrb.id, candidate)) return;
      setPremoveQueue((prev) =>
        prev.length >= 5 ? prev : [...prev, { kind: 'wall' as const, wall: candidate }]
      );
      return;
    }
    if (!currentPlayer || currentPlayer.wallsRemaining <= 0) return;
    if (!isLegalWallPlacement(state, currentPlayer.id, candidate)) return;

    const action = { type: 'PLACE_WALL' as const, wall: candidate };
    if (type === 'online') {
      if (online.connStatus !== 'connected') {
        setPremoveQueue((prev) =>
          prev.length >= 5 ? prev : [...prev, { kind: 'wall' as const, wall: candidate }]
        );
        return;
      }
      online.sendAction(action);
      return;
    }
    const result = applyAction(state, action);
    if (result.success) {
      setState(result.state);
      creditIncrement(currentPlayer.id, action);
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
      playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, currentUser.displayName),
      wallsEach,
    });
    setState(fresh);
    // Fresh clocks — never carry leftover time into the new match.
    const full = timeControl.minutes * 60;
    const reset: Record<string, number> = {};
    for (const p of fresh.players) reset[p.id] = full;
    setTimers(reset);
  };

  // Seat-relative placement: each side keeps its own players for the whole
  // game, so clocks never swap sides. Bottom is always the first player
  // (you, in AI games); the rest sit on top. The active ring shows turn.
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
    if (isCompleted || type === 'local' || myAiFinished) {
      onHome();
      return;
    }
    if (mySeatFinished) {
      leaveFinishedAndHome();
      return;
    }
    setResignOpen(true);
  }, [isCompleted, type, myAiFinished, onHome, mySeatFinished, leaveFinishedAndHome]);

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
  const displayState = replayState ?? state;

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

  // Hardware back mirrors the header back button: dismiss the topmost
  // overlay first (result modal, resign confirm, place modal, incoming
  // rematch toast, step-through replay), then follow the same
  // leave/resign routing. Always handled here while a match screen is
  // mounted, so App's generic pop never fires underneath a game.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
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
        (!onlinePlayerId || (!online.gameState && !offlineSnapshot?.myPlayerId))
      ) {
        // Still connecting: cancel the join, like the skeleton's Cancel.
        onHome();
        return true;
      }
      handleBackPress();
      return true;
    });
    return () => sub.remove();
  }, [
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
  const topActive = topList.findIndex(
    (p) => p.id === state.players[state.currentPlayerIndex]?.id
  );
  const topStripState: GameState = {
    ...state,
    players: topList,
    currentPlayerIndex: topActive,
  };
  const seatPlayer = state.players[seatIdx];
  const bottomStripState: GameState | null = seatPlayer
    ? {
        ...state,
        players: [seatPlayer],
        currentPlayerIndex: state.currentPlayerIndex === seatIdx ? 0 : -1,
      }
    : null;

  const aiRating = aiDifficulty === 'hard' ? 1750 : aiDifficulty === 'easy' ? 1250 : 1500;
  const playerRatings: Record<string, number> = {};
  state.players.forEach((p, idx) => {
    playerRatings[p.id] = type === 'ai' ? (isAiSide(idx) ? aiRating : 1500) : 1500;
  });

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

  // Screen overlay chip so the held wall follows the finger continuously.
  // Matches the (responsive) tray piece size.
  let chipStyle: { left: number; top: number; width: number; height: number } | null = null;
  if (wallDrag && rootRectRef.current) {
    const trayScale = Math.max(0.72, Math.min(1, windowWidth / 390));
    const isH = wallDrag.orientation === 'H';
    const w = (isH ? 56 : 12) * trayScale;
    const h = (isH ? 12 : 56) * trayScale;
    chipStyle = {
      left: wallDrag.pageX - rootRectRef.current.x - w / 2,
      top: wallDrag.pageY - rootRectRef.current.y - h / 2,
      width: w,
      height: h,
    };
  }

  if (
    type === 'online' &&
    (!onlinePlayerId || (!online.gameState && !offlineSnapshot?.myPlayerId))
  ) {
    // Once the join has definitively failed there is nothing to connect to, so
    // render a plain message instead of a spinner that can never resolve.
    if (online.joinError) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <View style={styles.skeletonTop}>
            <Text style={styles.syncingText}>{online.joinError}</Text>
            <TouchableOpacity
              style={styles.syncingBack}
              onPress={leaveFinishedAndHome}
              accessibilityRole="button"
            >
              <Text style={styles.syncingBackText}>Back to menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <View style={styles.headerInner}>
            <Feather name="chevron-left" size={24} color="#334155" />
          </View>
        </View>
        <View style={styles.skeletonTop}>
          <View style={styles.skeletonHud} />
          <View style={styles.skeletonBoard} />
          <View style={styles.skeletonBottom}>
            <View style={styles.skeletonTray} />
            <View style={styles.skeletonButton} />
          </View>
        </View>
        <View style={styles.syncingOverlay}>
          <ActivityIndicator size="large" color={THEME.colors.textPrimary} />
          <Text style={styles.syncingText}>Connecting to match…</Text>
          {/* Must release the seat, not just navigate. Plain onHome left the
              player seated in a live game, so their clock kept running and
              the game was forfeited in their name. */}
          <TouchableOpacity
            style={styles.syncingBack}
            onPress={leaveFinishedAndHome}
            accessibilityRole="button"
          >
            <Text style={styles.syncingBackText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={measureRoot}
      style={styles.container}
    >
      {/* White status strip on Android so the header truly reaches the top. */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Network Banners */}
      {type === 'online' && (online.connStatus === 'reconnecting' || online.connStatus === 'disconnected') && (
        <View style={styles.bannerWarning}>
          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.bannerText}>
            Connection lost · Reconnecting…{online.pendingCount > 0 ? ` · ${online.pendingCount} pending` : ''}
          </Text>
        </View>
      )}

      {/* Seat miss: sync arrived but neither your id nor name matches a
          seat (changed identity mid-flow). Never silently play as P1 —
          one tap resyncs, and the seat resolves as soon as ids line up. */}
      {type === 'online' && !!online.gameState && !online.myPlayerId && (
        <TouchableOpacity style={styles.bannerDanger} onPress={() => online.resync()}>
          <Text style={styles.bannerText}>
            Couldn't find your seat — tap to resync.
          </Text>
        </TouchableOpacity>
      )}

      {type === 'online' && online.opponentGrace && (
        <View style={styles.bannerDanger}>
          <Text style={styles.bannerText}>
            Opponent disconnected. Forfeit grace: {online.opponentGrace.seconds}s
          </Text>
        </View>
      )}

      {/* Measured top chrome (header + opponent cards) for board sizing. */}
      <View
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
            <Feather name="chevron-left" size={24} color="#334155" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Opponent card(s). Turn ring + timer highlight show whose move it is. */}
      {/* Strips ignore touches while a wall is dragged over them. */}
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
          ratings={playerRatings}
          compact
          bonus={lastBonus}
        />
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
              transform: [
                {
                  rotate:
                    type === 'local' && mode === '2p' && autoFlip
                      ? flipAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '180deg'],
                        })
                      : `${rotationTargetDeg}deg`,
                },
              ],
            }}
          >
          <GameBoard
            state={displayState}
            legalMoves={viewingStep !== null ? EMPTY_CELL_LIST : legalMoves}
            previewWall={null}
            selectedCell={viewingStep !== null ? null : selectedCellMemo}
            interactive={(humanTurn || canPremove) && !wallDrag && !flipping && viewingStep === null}
            dragSlot={dragSlot}
            moveHintColor={wallDrag ? trayColor : hintColor}
            premoveMarks={viewingStep !== null ? EMPTY_PREMOVE_MARKS : premoveMarks}
            hideDots={hideDots}
            queuedWalls={viewingStep !== null ? EMPTY_QUEUED_WALLS : queuedWallEntries}
            onQueuedWallPress={canPremove && viewingStep === null ? handleQueuedWallPress : undefined}
            size={measuredBoardSize}
            flipAnim={type === 'local' && mode === '2p' && autoFlip ? flipAnim : null}
            rotationDeg={type === 'local' && mode === '2p' && autoFlip ? 0 : rotationTargetDeg}
            onCellPress={viewingStep !== null ? undefined : handleCellPress}
            onMetricsChange={handleMetricsChange}
          />
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
                ratings={playerRatings}
                bonus={lastBonus}
                hideWallsBadge
              />
            </View>
          )}
          {/* Fixed slot: the inventory stays visible every turn (inert off-turn). */}
          {!isCompleted && (
            <View style={styles.traySlot}>
              {trayPlayer && (
                <WallTray
                  color={trayColor}
                  count={trayPlayer.wallsRemaining}
                  held={wallDrag?.orientation ?? null}
                  disabled={!(humanTurn || (canPremove && queueOn))}
                  onDragStart={handleTrayStart}
                  onDragMove={handleTrayMove}
                  onDragEnd={handleTrayEnd}
                />
              )}
            </View>
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
                  <Feather name="chevrons-left" size={18} color="#334155" />
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
                  <Feather name="chevron-left" size={18} color="#334155" />
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
                  <Feather name={replaying ? 'pause' : 'play'} size={18} color="#334155" />
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
                  <Feather name="chevron-right" size={18} color="#334155" />
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
                  <Feather name="chevrons-right" size={18} color="#334155" />
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
                <Feather name="flag" size={17} color="#64748B" />
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
                <Feather name="log-out" size={17} color="#64748B" />
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
              <Feather name="flag" size={28} color="#BA1A1A" />
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
              <Feather name="award" size={30} color="#D97706" />
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
        ratingDelta={type === 'online' ? online.gameEndedResult?.ratingChanges?.[currentUser.userId]?.delta : undefined}
        ratingAfter={type === 'online' ? online.gameEndedResult?.ratingChanges?.[currentUser.userId]?.after : undefined}
        opponentName={
          isMultiplayer
            ? undefined
            : type === 'ai'
            ? `AI (${aiDifficulty})`
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
            <Feather name="rotate-ccw" size={18} color="#2563EB" />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: 0,
    paddingBottom: 8,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
    // No text selection anywhere while dragging walls around the board.
    userSelect: 'none',
  },
  skeletonTop: {
    flex: 1,
    paddingTop: 8,
    gap: 8,
  },
  skeletonHud: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonBoard: {
    flex: 1,
    alignSelf: 'center',
    aspectRatio: 1,
    width: '100%',
    maxWidth: 420,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonBottom: {
    gap: 8,
  },
  skeletonTray: {
    height: 78,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonButton: {
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  syncingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(248,250,252,0.72)',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    // Exact status height on Android; SafeAreaView owns the inset on iOS.
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  headerInner: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topStripWrap: {
    marginTop: 8,
    marginBottom: 8,
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
    minHeight: 92,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resignText: {
    fontFamily: THEME.fonts.medium,
    color: '#64748B',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  finishCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  finishTitle: {
    fontFamily: THEME.fonts.extraBold,
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  finishDesc: {
    fontFamily: THEME.fonts.medium,
    color: '#64748B',
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
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  finishPrimaryText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
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
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  resignTitle: {
    fontFamily: THEME.fonts.bold,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  resignDesc: {
    fontFamily: THEME.fonts.regular,
    color: '#64748B',
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
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  resignConfirmText: {
    fontFamily: THEME.fonts.semiBold,
    color: '#FFFFFF',
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
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  replayBar: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  replayBtnDisabled: {
    opacity: 0.35,
  },
  replayStep: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
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
    color: '#64748B',
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
  syncingText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  syncingBack: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
  },
  syncingBackText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  bannerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    marginBottom: 6,
  },
  bannerDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    marginBottom: 6,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.sm,
    marginBottom: 6,
  },
  bannerText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  rematchToastOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 28,
  },
  rematchToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...THEME.shadows.card,
  },
  rematchToastText: { flex: 1, fontFamily: THEME.fonts.semiBold, fontSize: 13, color: '#0F172A' },
  rematchDeclineBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#F1F5F9' },
  rematchDeclineText: { fontFamily: THEME.fonts.semiBold, fontSize: 12, color: '#64748B' },
  rematchAcceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#2563EB' },
  rematchAcceptText: { fontFamily: THEME.fonts.bold, fontSize: 12, color: '#FFFFFF' },
});
