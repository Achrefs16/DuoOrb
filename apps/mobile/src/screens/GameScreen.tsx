import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Modal, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AIDifficulty,
  AI_PROFILES,
  botById,
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
  getLegalMoves,
  getLegalMovesFrom,
  getShortestDistance,
  isLegalWallPlacement,
  playerCountForMode,
  rebuildStateAtStep,
  routeOf,
} from '@duoorb/game-core';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import type { GameSyncDto } from '@duoorb/protocol';
import { GameBoard, boardRim, isInsideBoard, nearestWallSlot } from '../components/GameBoard';
import { PlayerStrip, type SeatStatus } from '../components/GameHud';
import { GameOverModal } from '../components/GameOverModal';
import { fetchOrComputeReview } from '../analysis/reviewLoader';
import { reviewCacheKey, cacheReview } from './GameReviewScreen';
import { PlayerProfileScreen } from './PlayerProfileScreen';
import { SideChoice } from './MatchSetupScreen';
import { WallTray } from '../components/WallTray';
import { playGoalSound, playOwnMoveSound, playOpponentMoveSound, playJumpSound, playWallSound, playGameStartSound, playGameEndSound, playIllegalMoveSound, playNotifySound, playThirtySecondsSound, preloadSounds } from '../audio/sounds';
import { toast } from '../components/AppToast';
import { SavedGameRecord, loadOnlineGameSnapshot, recordBotVictoryStars, saveGameToHistory, saveOnlineGameSnapshot } from '../storage/gameStorage';
import { THEME, hexToRgba, playerColor, useStyles, useTheme, wallPreviewColor } from '../theme';
import { CLOCK_ENABLED, DEFAULT_TIME_CONTROL, TimeControl, effectiveIncrement } from '../timeControls';
import { useOnlineGame } from '../network/useOnlineGame';
import { useQuickReactions, groupReactionsBySeat } from '../network/useQuickReactions';import { ReactionDock, ReactionTray } from '../components/QuickReactions';
import type { ReactionKind } from '../network/useQuickReactions';
import { WallDragGhostProvider } from '../components/WallDragGhost';
import { SkinBackdrop } from '../components/SkinBackdrop';
import { useBoardSkin } from '../theme/boardTheme';
import { useIdentity } from '../network/auth';
import { socketManager } from '../network/socket';
import { RewardSheet } from '../components/RewardSheet';
import { PremiumSheet } from '../components/PremiumSheet';
import { useBotDialogue } from '../ai/useBotDialogue';
import { cancelAiSearch, getAiMove } from '../ai/aiWorkerClient';
import { BotSpeechBubble } from '../components/BotSpeechBubble';
import { isPremiumActive, refreshPremium, usePremium } from '../monetization/premium';
import { preloadRewarded, showRewarded } from '../monetization/ads';
import { markAnalysisUnlocked, requestAnalysisEntry } from '../monetization/analysisAccess';
import { recordGameFinished, showInterstitialIfDue } from '../monetization/interstitial';
import { preloadInterstitial } from '../monetization/adsNative';
import { ensureSessionRecorded } from '../monetization/realAds';
import { canUndoAiTurn, findUndoTargetStep } from '../lib/undo';
import { useTranslation } from '../i18n';
import { BotAvatar } from '../components/BotAvatar';
import { SmoothStar } from '../components/SmoothStar';
import { WallIcon } from '../components/WallIcon';
import { setSfxMuted } from '../audio/sfx';

function formatTimer(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function countryFlagFor(name?: string, botId?: string | null): string {
  if (botId === 'martin') return '🇺🇸';
  if (botId === 'pip') return '🇬🇧';
  if (botId === 'elias') return '🇩🇪';
  if (botId === 'bram') return '🇳🇱';
  if (botId === 'nelson') return '🇸🇪';
  if (botId === 'vex') return '🇯🇵';
  if (botId === 'jamal') return '🇫🇷';
  if (botId === 'marcus') return '🇮🇹';
  if (botId === 'viktor') return '🇷🇺';
  if (botId === 'achref') return '🇹🇳';
  const lower = name?.toLowerCase() ?? '';
  if (lower.includes('achref')) return '🇹🇳';
  if (lower.includes('martin')) return '🇺🇸';
  return '🌐';
}

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
  /** Premium personality id for AI games (null = generic difficulty bot). */
  botId?: string | null;
  timeControl?: TimeControl;
  incrementEnabled?: boolean;
  premoveEnabled?: boolean;
  extendedQueue?: boolean;
  testThink?: boolean;
  sideChoice?: SideChoice;
  onHome: () => void;
  onNewGame: () => void;
  onRematchAccepted?: (newGameId: string) => void;
  onAnalyze: (
    initialState: GameState,
    history: any[],
    perspectiveIdx: number,
    access: { gameId: string; historyLength: number },
    ratings?: Record<string, number>,
    seatPremium?: Record<string, boolean>
  ) => void;
  /** Opens the shared player profile for a seat that has an account behind it. */
  onOpenPlayerProfile?: (player: { userId: string; username: string }) => void;
  onSelectBots?: () => void;
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
  ownName: string,
  /** Premium personality display name, or null for the generic bot. */
  aiName: string | null
) {
  const n = playerCountForMode(mode);
  if (type === 'ai') {
    if (mode === '2p') {
      const foe = aiName ?? `AI · ${aiDifficulty}`;
      return humanIdx === 0 ? [ownName, foe] : [foe, ownName];
    }
    // AI games: you lead, every other seat is an AI opponent.
    return Array.from({ length: n }, (_, i) =>
      i === 0
        ? ownName
        : aiName
          ? i === 1
            ? aiName
            : `${aiName} ${i}`
          : i === 1
            ? 'AI'
            : `AI ${i}`
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
  botId = null,
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
  onSelectBots,
  // Accepted for API compatibility (App passes it) but intentionally
  // unused: opponent profiles open as an in-game overlay so this screen
  // never unmounts mid-match. See profilePlayer.
}) => {
  const styles = useStyles(createStyles);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const identity = useIdentity();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const dockIconColor = THEME.colors.textPrimary;
  const dockLabelColor = THEME.colors.textSecondary;
  const dockDisabledColor = THEME.colors.textMuted;

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
  // Premium personality (MONETIZATION.md P4.2.2): its profile replaces
  // AI_PROFILES[aiDifficulty] for every AI seat; null = generic bot (D5).
  const personality = type === 'ai' ? botById(botId) : null;
  const [initialState, setInitialState] = useState<GameState>(() =>
    createInitialState({ mode, playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, identity?.displayName ?? 'You', personality?.name ?? null), wallsEach })
  );

  const [state, setState] = useState<GameState>(initialState);

  const botDialogue = useBotDialogue({
    personality,
    state,
    humanIdx,
    enabled: type === 'ai' && state.players.length === 2,
  });

  const botAvatarKeyBySeat = useMemo(() => {
    if (type !== 'ai' || !personality) return undefined;
    const map: Record<string, string> = {};
    for (let i = 0; i < state.players.length; i++) {
      if (i !== humanIdx && personality.avatarKey) {
        map[state.players[i].id] = personality.avatarKey;
      }
    }
    return map;
  }, [type, personality, humanIdx, state.players]);

  const [optionsOpen, setOptionsOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [chatTrayOpen, setChatTrayOpen] = useState(false);
  const [hintMove, setHintMove] = useState<CellCoord | null>(null);

  const seatRatings = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (type === 'ai') {
        if (i === humanIdx) {
          map[p.id] = (identity as any)?.rating ?? 1200;
        } else {
          map[p.id] = personality?.elo ?? 400;
        }
      } else if (type === 'online') {
        if (i === humanIdx) {
          map[p.id] = (identity as any)?.rating ?? 1200;
        } else {
          map[p.id] = 1150;
        }
      }
    }
    return map;
  }, [state.players, type, humanIdx, identity, personality]);

  const seatCountryFlags = useMemo(() => {
    const map: Record<string, string> = {};
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (type === 'ai') {
        if (i === humanIdx) {
          map[p.id] = countryFlagFor(p.displayName);
        } else {
          map[p.id] = countryFlagFor(personality?.name, personality?.id);
        }
      } else {
        map[p.id] = countryFlagFor(p.displayName);
      }
    }
    return map;
  }, [state.players, type, humanIdx, personality]);

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
  const [botStarsEarned, setBotStarsEarned] = useState<1 | 2 | 3 | null>(null);
  const [localMoveCounts, setLocalMoveCounts] = useState<{ best: number; excellent: number; good: number } | null>(null);

  useEffect(() => {
    if (state.status !== 'COMPLETED' || state.history.length === 0) {
      setLocalMoveCounts(null);
      return;
    }
    let cancelled = false;
    const myId =
      type === 'online'
        ? online.myPlayerId
        : type === 'ai'
        ? state.players[humanIdx]?.id
        : state.players[0]?.id;

    void fetchOrComputeReview(initialState, state.history, state.gameId, {
      isCancelled: () => cancelled,
    }).then((review) => {
      if (cancelled || !review) return;
      const userMoves = review.moveAnalyses.filter((m) => m.playerId === myId);
      const best = userMoves.filter(
        (m) =>
          m.assessment === 'BEST' ||
          m.assessment === 'BRILLIANT' ||
          m.assessment === 'GREAT'
      ).length;
      const excellent = userMoves.filter((m) => m.assessment === 'EXCELLENT').length;
      const good = userMoves.filter((m) => m.assessment === 'GOOD').length;
      setLocalMoveCounts({ best, excellent, good });
    }).catch(() => {
      if (!cancelled) setLocalMoveCounts({ best: 0, excellent: 0, good: 0 });
    });

    return () => {
      cancelled = true;
    };
  }, [state.status, state.gameId, state.history, initialState, type, humanIdx, online.myPlayerId]);
  // Rewarded-analysis gate (MONETIZATION.md P3.2): the GameOverModal Analyze
  // row funnels through handleAnalyzePress below — premium/unlocked go
  // straight to review, everyone else gets this sheet (one ad = this game).
  const premiumState = usePremium();
  // Premium board skin: takes over the whole match page (backdrop + page
  // background) behind the HUD, board and tray. Classic leaves both unset.
  const skin = useBoardSkin();
  // Player cards wear the skin too (bg + border + matching ink, always as a
  // set so contrast holds). Undefined = app theme owns the cards.
  const hudSurface =
    skin.hudCard && skin.hudBorder && skin.hudInk && skin.hudSubInk && skin.hudChip
      ? {
          card: skin.hudCard,
          border: skin.hudBorder,
          ink: skin.hudInk,
          subInk: skin.hudSubInk,
          chip: skin.hudChip,
        }
      : undefined;
  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  // Offline AI undo economy: one free undo for Premium, otherwise a rewarded
  // video grants three credits. `undosUsedRef` belongs to the 3-star mastery
  // rating (Phase 3) and resets per match.
  const [undoCredits, setUndoCredits] = useState(0);
  const [undoSheetOpen, setUndoSheetOpen] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);
  const undosUsedRef = useRef(0);
  // One interstitial decision per finished match, never per button press.
  const interstitialFiredRef = useRef(false);
  const resultRecordedRef = useRef<string | null>(null);
  // Paywall entry routing (P7.2): this screen only ever sells from analysis.
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumSource, setPremiumSource] = useState('analysis');

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
    setBotStarsEarned(null);
    interstitialFiredRef.current = false;
    resultRecordedRef.current = null;
    undosUsedRef.current = 0;
    // Fresh clocks, fresh warnings: the 30s crossing refs belong to the old
    // game — without this a rematch (same mount) never warns (I4).
    warned30Ref.current = false;
    lastMySecsRef.current = null;
  }, [type, onlineGameId]);

  // Warm the video units while the player is still on the board. The
  // interstitial must be ready before the result modal appears; undo is only
  // relevant in AI games.
  useEffect(() => {
    void preloadInterstitial();
    if (type === 'ai') preloadRewarded('undo');
  }, [type, state.gameId]);

  const [timers, setTimers] = useState<Record<string, number>>(() => {
    const defaultSec = timeControl.minutes * 60;
    const initialTimers: Record<string, number> = {};
    for (const p of initialState.players) {
      initialTimers[p.id] = defaultSec;
    }
    return initialTimers;
  });
  // Exact milliseconds for local/AI clocks. The visible `timers` state only
  // changes when the displayed second changes; elapsed time is measured from
  // Date.now(), so backgrounding or a slow JS frame can never freeze a clock.
  const remainingMsRef = useRef<Record<string, number>>(
    Object.fromEntries(
      initialState.players.map((p) => [p.id, timeControl.minutes * 60_000])
    )
  );
  const lastClockTickAtRef = useRef<number>(0);
  const clockTimeoutRef = useRef(false);
  const activeClockIdRef = useRef<string | null>(null);

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
      remainingMsRef.current[moverId] =
        (remainingMsRef.current[moverId] ?? 0) + inc * 1000;
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

  // On Web: prevent screen sleep while match is active
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      let sentinel: any = null;
      if (state.status === 'IN_PROGRESS') {
        (navigator as any).wakeLock
          ?.request('screen')
          .then((lock: any) => {
            sentinel = lock;
          })
          .catch(() => {});
      }
      return () => {
        sentinel?.release?.().catch(() => {});
      };
    }
  }, [state.status]);

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
  const [anchorW, setAnchorW] = useState(0);
  // Measured board-anchor width: the truth on every platform. Desktop web
  // CSS squeezes the app column below the window width, so window-based
  // math overflows — the anchor reports what actually fits.
  const isTabletScreen = windowWidth >= 600 && (windowWidth <= 1100 || windowHeight >= windowWidth);
  const maxContainerWidth = Platform.OS === 'web' ? (isTabletScreen ? 580 : 420) : windowWidth;
  const effectiveWidth = Math.min(windowWidth, maxContainerWidth);

  // Board size, unified for 2p and 4p: full screen width edge-to-edge (effectiveWidth),
  // capped only by vertical space on extremely short devices like Chess.com.
  const measuredBoardSize = Math.max(
    200,
    Math.floor(
      Math.min(
        effectiveWidth,
        anchorW > 0 ? anchorW : Number.POSITIVE_INFINITY,
        windowHeight - topH - bottomH - 8
      )
    )
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

  // Settle the outgoing player's clock the instant a turn ends. The 200ms
  // interval below does the visible countdown, but a move can land between
  // ticks — this closes that gap so no player gains or loses a free slice.
  useEffect(() => {
    if (type === 'online') return;
    const activeId = state.players[state.currentPlayerIndex]?.id ?? null;
    const previousId = activeClockIdRef.current;
    if (undoSheetOpen || undoBusy) {
      // The reward sheet/ad freezes both sides. Sync the turn pointer without
      // charging the player who was on move when the sheet opened.
      if (activeId !== previousId) {
        activeClockIdRef.current = activeId;
        lastClockTickAtRef.current = Date.now();
      }
      return;
    }
    if (previousId && previousId !== activeId) {
      const now = Date.now();
      const elapsed = Math.max(0, now - lastClockTickAtRef.current);
      const before = remainingMsRef.current[previousId];
      if (elapsed > 0 && before !== undefined) {
        const after = Math.max(0, before - elapsed);
        remainingMsRef.current[previousId] = after;
        const nextSec = Math.ceil(after / 1000);
        setTimers((prev) =>
          prev[previousId] === nextSec ? prev : { ...prev, [previousId]: nextSec }
        );
      }
    }
    if (activeId !== previousId) {
      activeClockIdRef.current = activeId;
      lastClockTickAtRef.current = Date.now();
    }
  }, [state.currentPlayerIndex, state.moveNumber, state.status, state.players, type, undoSheetOpen, undoBusy]);

  // Clock countdown (offline only; online clocks are server-synchronized).
  // TESTING: CLOCK_ENABLED=false disables the countdown entirely, so no match
  // can be lost on time. See timeControls.ts.
  useEffect(() => {
    if (type === 'online') return;
    if (!CLOCK_ENABLED) return;
    if (state.status !== 'IN_PROGRESS') return;
    // The undo reward sheet/ad is a system pause: never let a player lose on
    // time while they are watching a video they chose to watch.
    if (undoSheetOpen || undoBusy) {
      lastClockTickAtRef.current = Date.now();
      return;
    }
    lastClockTickAtRef.current = Date.now();
    const interval = setInterval(() => {
      if (clockTimeoutRef.current) return;
      const live = stateRef.current;
      if (live.status !== 'IN_PROGRESS') return;
      const active = live.players[live.currentPlayerIndex];
      if (!active) return;
      const now = Date.now();
      const elapsed = Math.max(0, now - lastClockTickAtRef.current);
      lastClockTickAtRef.current = now;
      if (activeClockIdRef.current !== active.id) {
        // The settle effect normally runs first; if the tick won the race,
        // charge nothing to the new player for the previous turn's tail.
        activeClockIdRef.current = active.id;
        return;
      }
      const before = remainingMsRef.current[active.id] ?? 0;
      const after = Math.max(0, before - elapsed);
      remainingMsRef.current[active.id] = after;
      const nextSec = Math.ceil(after / 1000);
      setTimers((prev) =>
        prev[active.id] === nextSec ? prev : { ...prev, [active.id]: nextSec }
      );
      if (after <= 0) {
        clockTimeoutRef.current = true;
        const res = applyAction(live, { type: 'TIMEOUT' });
        if (res.success) setState(res.state);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [state.status, type, undoSheetOpen, undoBusy]);

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
          const profile = personality?.profile ?? AI_PROFILES[aiDifficulty];
          // Unbounded deep search off the critical path: time slices yield
          // to the event loop (thinking indicator stays alive), depth is the
          // only ceiling, cancellation keeps the best completed ply.
          const isBlitzMatch =
            Boolean(timeControl?.id.includes('blitz')) ||
            Boolean(timeControl?.id.includes('bullet')) ||
            (timeControl !== undefined && timeControl.minutes < 3);
          const aiAction = await getAiMove(live, profile, undefined, {
            shouldCancel: () => cancelled,
            budget: isBlitzMatch ? { timeMs: 250, maxDepth: 4 } : undefined,
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
      cancelAiSearch();
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
  // Rematch offers persist as a chip until accepted, declined, expired
  // server-side (30s hook timer), or superseded — the 4s auto-dismiss used
  // to strand the offeror waiting the full TTL with no visible offer, and a
  // Decline that only hid the toast locally. Keyed on the offer nonce so a
  // re-sent offer always re-shows.
  useEffect(() => {
    if (type !== 'online' || online.rematchOfferNonce === 0) return;
    setRematchIncomingDismissed(false);
  }, [type, online.rematchOfferNonce]);

  // The offeror waits with a visible chip for the server TTL, not 4s — then
  // stops on its own. An explicit decline from the other side clears it
  // immediately (see below).
  useEffect(() => {
    if (type !== 'online' || !rematchSent) return;
    const t = setTimeout(() => setRematchSent(false), 30000);
    return () => clearTimeout(t);
  }, [type, rematchSent]);

  // The other side declined: stop waiting now.
  const lastRematchDeclinedRef = useRef(0);
  useEffect(() => {
    if (type !== 'online' || online.rematchDeclinedNonce === 0) return;
    if (lastRematchDeclinedRef.current === online.rematchDeclinedNonce) return;
    lastRematchDeclinedRef.current = online.rematchDeclinedNonce;
    setRematchSent(false);
  }, [type, online.rematchDeclinedNonce]);

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
      // Warm every video unit while the user reads the result — the Analysis
      // and Undo gates later show instantly instead of loading then.
      preloadRewarded('analysis');
      if (type === 'ai') preloadRewarded('undo');
      void preloadInterstitial();
      setFinishModal(null);
      setPremoveQueue([]);
      setPremoveSel(null);
      const winner = state.players.find((p) => p.id === state.winnerId);
      const humanSeatId =
        type === 'ai'
          ? state.players[humanIdx]?.id
          : type === 'online'
          ? online.myPlayerId
          : state.players[0]?.id;
      const effectiveWon =
        type === 'local'
          ? true
          : Boolean(state.winnerId && humanSeatId && state.winnerId === humanSeatId);

      // 3-star mastery: a clean win (no Undo) and a healthy lead outrank a
      // grind. The bot keeps the best rating ever earned; losses never lower it.
      if (type === 'ai' && effectiveWon && humanSeatId) {
        const me = state.players.find((p) => p.id === humanSeatId);
        const foes = state.players.filter((p) => p.id !== humanSeatId);
        const oppDist = foes.length
          ? Math.min(
              ...foes.map((p) =>
                getShortestDistance(p.position, p.goalDirection, state.walls, state.mode)
              )
            )
          : 0;
        const myWalls = me?.wallsRemaining ?? 0;
        const undos = undosUsedRef.current;
        let stars: 1 | 2 | 3 = 1;
        if (undos === 0 && (oppDist >= 2 || myWalls >= 2)) stars = 2;
        if (undos === 0 && (oppDist >= 3 || (oppDist >= 2 && myWalls >= 3))) stars = 3;
        setBotStarsEarned(stars);
        void recordBotVictoryStars(
          personality?.id ?? `difficulty:${aiDifficulty}`,
          stars,
          oppDist
        );
      } else {
        setBotStarsEarned(null);
      }

      const gameSec = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
      const myPlayerId =
        type === 'ai'
          ? state.players[humanIdx]?.id ?? null
          : type === 'online'
            ? online.myPlayerId
            : null;
      // Record once, at completion — never at exit. The exit decision later
      // reads this count, so New Match and Close Match cannot double count.
      if (resultRecordedRef.current !== state.gameId) {
        resultRecordedRef.current = state.gameId;
        void recordGameFinished({
          userWon: effectiveWon,
          gameSec,
          gameId: state.gameId,
        });
      }
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
        myPlayerId,
        perspectivePlayerId: myPlayerId,
        isViewerSeated: type !== 'local' && myPlayerId != null,
        endedReason: 'GOAL',
        timeControlMinutes: timeControl?.minutes,
        incrementSeconds: timeControl
          ? effectiveIncrement(timeControl, incrementEnabled ?? true)
          : undefined,
        botId: personality?.id,
        botName: personality?.name,
        botRating: personality?.elo,
        totalMoves: state.history.length,
        durationSeconds: gameSec,
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
    interstitialFiredRef.current = false;
    resultRecordedRef.current = null;
    undosUsedRef.current = 0;
    const fresh = createInitialState({
      mode,
      playerNames: playerNamesFor(mode, type, aiDifficulty, humanIdx, identity?.displayName ?? 'You', personality?.name ?? null),
      wallsEach,
    });
    setState(fresh);
    setInitialState(fresh);
    historyLenRef.current = 0;
    // Fresh clocks — never carry leftover time into the new match.
    const full = timeControl.minutes * 60;
    const reset: Record<string, number> = {};
    const resetMs: Record<string, number> = {};
    for (const p of fresh.players) {
      reset[p.id] = full;
      resetMs[p.id] = full * 1000;
    }
    setTimers(reset);
    remainingMsRef.current = resetMs;
    lastClockTickAtRef.current = Date.now();
    activeClockIdRef.current = fresh.players[fresh.currentPlayerIndex]?.id ?? null;
    clockTimeoutRef.current = false;
    setBotStarsEarned(null);
  };

  // Seat-relative placement: each side keeps its own players for the whole
  // game, so clocks never swap sides. 1v1: one opponent on top, you at the
  // bottom. Multiplayer: two cards above the board, two below — the bottom
  // row is always your seat plus the last opponent, the rest sit on top.
  // You always sit at the bottom on your own phone: the human side in AI
  // games, the first player otherwise. Nobody's clock ever swaps sides.
  const seatIdx = type === 'online' ? activeHumanIdx : type === 'ai' ? humanIdx : 0;

  // Premium badges, keyed by seat (P5.2): the sync's frozen premium list mapped
  // through the same seat→account inversion. AI/local tables have no accounts
  // behind seats — no badges, by construction.
  const seatPremium = useMemo<Record<string, boolean>>(() => {
    if (type !== 'online') return {};
    const premium = new Set(online.premiumUserIds ?? []);
    if (premium.size === 0) return {};
    const map: Record<string, boolean> = {};
    for (const [seatId, userId] of Object.entries(online.playerUserIds ?? {})) {
      if (premium.has(userId)) map[seatId] = true;
    }
    return map;
  }, [type, online.playerUserIds, online.premiumUserIds]);

  // Rewarded-analysis gate (MONETIZATION.md P3.2): the access key identifies
  // THIS finished game — state.gameId is fresh per mount and per rematch, so
  // every completed game gates separately while re-opens stay free (E13).
  const openReview = useCallback(() => {
    setRewardOpen(false);
    setShowGameOver(false);
    onAnalyze(
      initialState,
      state.history,
      seatIdx,
      {
        gameId: state.gameId,
        historyLength: state.history.length,
      },
      undefined,
      seatPremium
    );
  }, [initialState, state.history, state.gameId, seatIdx, onAnalyze, seatPremium]);

  const handleAnalyzePress = useCallback(async () => {
    setShowGameOver(false);
    // Single gate: premium unlimited, already-unlocked free, else the free
    // daily when available — 'locked' opens the one-ad sheet.
    const entry = await requestAnalysisEntry(
      isPremiumActive(premiumState),
      state.gameId,
      state.history.length
    );
    if (entry === 'locked') {
      setRewardError(null);
      setRewardOpen(true);
      return;
    }
    openReview();
  }, [premiumState, state.gameId, state.history.length, openReview]);

  const handleWatchAd = useCallback(async () => {
    setRewardBusy(true);
    setRewardError(null);
    const res = await showRewarded('analysis');
    if (res.earned) {
      try {
        await markAnalysisUnlocked(state.gameId, state.history.length);
        openReview();
      } catch {
        // E12: the unlock write failed — stay locked, say so, retry allowed.
        setRewardError('store');
      }
    } else {
      // E10/E11: early close, no fill, or SDK error — sheet stays, no dead end.
      setRewardError(res.error ?? 'dismissed');
    }
    setRewardBusy(false);
  }, [state.gameId, state.history.length, openReview]);

  // My seat + finished state (online): a FINISHED player leaves freely
  // with placement kept; only ACTIVE players resign/forfeit on departure.
  const mySeat = state.players[seatIdx] ?? null;
  const mySeatFinished = type === 'online' && mySeat?.status === 'FINISHED';
  const myAiFinished = type === 'ai' && myOrb?.status === 'FINISHED';
  const isCompleted = state.status === 'COMPLETED';
  const isMultiplayer = state.players.length > 2;
  // Viewer victory (same definition the result modal shows): drives the
  // win-only interstitial on result exit — losses never show one.
  const userWon = state.winnerId
    ? type === 'online'
      ? state.winnerId === online.myPlayerId
      : state.winnerId === state.players[humanIdx]?.id
    : false;

  /**
   * Single post-match video decision. New Match and Close Match share it so a
   * player can never see two interstitials for one result. Rematch never
   * calls it. Navigation happens after the decision either way.
   */
  const maybeShowPostMatchVideoAd = useCallback(
    async (trigger: 'new_match' | 'close_match') => {
      if (!isCompleted || interstitialFiredRef.current) return;
      interstitialFiredRef.current = true;
      const gameSec = Math.max(
        0,
        Math.round((Date.now() - state.startedAt) / 1000)
      );
      const effectiveWon = type === 'local' ? true : Boolean(userWon);
      const premiumNow = isPremiumActive(premiumState);
      const sessions = await ensureSessionRecorded().catch(() => 0);
      await showInterstitialIfDue({
        isPremium: premiumNow,
        sessions: typeof sessions === 'number' ? sessions : 0,
        userWon: effectiveWon,
        gameSec,
        trigger,
      });
    },
    [isCompleted, state.startedAt, type, userWon, premiumState]
  );

  // Undo is an AI-only courtesy: rewind your last move (and every AI reply
  // after it) back to your turn. Premium is unlimited; free players spend one
  // credit per undo, or watch a rewarded video for three.
  const undoAvailable = canUndoAiTurn({
    isAiGame: type === 'ai',
    completed: isCompleted,
    isAiThinking,
    currentPlayerIndex: state.currentPlayerIndex,
    humanSeatIndex: humanIdx,
    historyLength: state.history.length,
    humanSeatActive: state.players[humanIdx]?.status === 'ACTIVE',
  });

  const executeUndoMove = useCallback((): boolean => {
    const live = stateRef.current;
    if (type !== 'ai' || isAiThinking) return false;
    if (live.status !== 'IN_PROGRESS') return false;
    if (live.currentPlayerIndex !== humanIdx) return false;
    if (live.history.length < 2) return false;
    const humanId = live.players[humanIdx]?.id;
    if (!humanId) return false;
    // Rewind to before your last action, not merely two plies: in 3P/4P AI
    // tables several bots may have replied since your turn.
    const targetStep = findUndoTargetStep(live.history, humanId);
    if (targetStep < 0) return false;
    try {
      const rewound = rebuildStateAtStep(initialState, live.history, targetStep);
      const next = { ...rewound, history: live.history.slice(0, targetStep) };
      setState(next);
      stateRef.current = next;
      setPremoveQueue([]);
      setPremoveSel(null);
      undosUsedRef.current += 1;
      return true;
    } catch {
      return false;
    }
  }, [type, isAiThinking, humanIdx, initialState]);

  const handleUndoPress = useCallback(() => {
    if (!undoAvailable) return;
    executeUndoMove();
  }, [undoAvailable, executeUndoMove]);

  const handleUndoWatch = useCallback(async () => {
    setUndoBusy(true);
    setUndoError(null);
    const res = await showRewarded('undo');
    if (res.earned) {
      // Grant three credits, then spend one only if the undo actually ran
      // (the match could have ended while the video was playing).
      const ok = executeUndoMove();
      setUndoCredits((c) => c + (ok ? 2 : 3));
      setUndoSheetOpen(false);
    } else {
      setUndoError(res.error ?? 'dismissed');
    }
    setUndoBusy(false);
  }, [executeUndoMove]);

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
      // Personalities taunt with 'angry' (reads as a jab); the generic bot
      // keeps its familiar laugh. Praise stays a clap either way.
      reactions.preview(personality ? 'angry' : 'laugh');
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

  // Resign is available in ongoing online and AI bot matches.
  const canResign =
    !isCompleted && (type === 'online' || type === 'ai') && !mySeatFinished;

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
    // Ongoing or completed AI/local games directly exit without resign dialog.
    if (isCompleted || type === 'local' || type === 'ai' || myAiFinished) {
      if (isCompleted) {
        void maybeShowPostMatchVideoAd('close_match').finally(onHome);
      } else {
        onHome();
      }
      return;
    }
    if (mySeatFinished) {
      leaveFinishedAndHome();
      return;
    }
    setResignOpen(true);
  }, [isCompleted, type, myAiFinished, onHome, mySeatFinished, leaveFinishedAndHome, maybeShowPostMatchVideoAd, online.joinError, online.gameState, online.myPlayerId]);

  // ---- In-match replay (finished games only) ----
  // Reconstructs the opening position from the mode + final names, then
  // replays the actual stored moves with the existing replay function.
  const replayBase: GameState | null = useMemo(() => {
    if (type === 'local' || type === 'ai') return initialState;
    if (initialState) return initialState;
    const anchor = state.players[0];
    const placed = state.history.filter(
      (h) => h.action.type === 'PLACE_WALL' && h.playerId === anchor?.id
    ).length;
    return createInitialState({
      mode: state.mode,
      playerNames: state.players.map((p) => p.displayName),
      wallsEach: (anchor?.wallsRemaining ?? 10) + placed,
    });
  }, [type, initialState, state.mode, state.players, state.history]);
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

  const handleHintPress = useCallback(() => {
    if (!humanTurn || !currentPlayer) {
      return;
    }
    const moves = getLegalMoves(displayState, currentPlayer.id);
    if (!moves || moves.length === 0) return;
    let bestMove = moves[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const m of moves) {
      const d = getShortestDistance(m, currentPlayer.goalDirection, displayState.walls, displayState.mode);
      if (d < bestDist) {
        bestDist = d;
        bestMove = m;
      }
    }
    setHintMove(bestMove);
    playNotifySound();
  }, [humanTurn, currentPlayer, displayState]);

  useEffect(() => {
    setHintMove(null);
  }, [state.history.length]);

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
    if (Platform.OS === 'web') return;
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
  const ownSeat = online.myPlayerId;
  // Every away seat gets its own countdown — on a 3P/4P table two seats can
  // be away at once, and each card counts down its own window.
  for (const grace of Object.values(online.opponentGrace)) {
    const seat = grace.playerId ?? null;
    // playerId is always sent for online matches; an entry without one names
    // no card, so it is skipped rather than pinned on the wrong seat.
    // `mine` names the consequence on the card of the player racing the
    // deadline (I3): everyone else reads the neutral condition.
    if (seat) {
      map[seat] = { kind: 'disconnected', secondsLeft: grace.seconds, mine: seat === ownSeat };
    }
  }
  if (online.afkWarning) {
    const seat = online.afkWarning.playerId ?? online.myPlayerId;
    if (seat) {
      map[seat] = { kind: 'afk', secondsLeft: online.afkWarning.secondsRemaining, mine: seat === ownSeat };
    }
  }
  // Own transport state, on the player's own card only — and only when no
  // server-driven state already owns that seat. Just the two states that
  // need no other UI: a dropped socket and a failed join. (A move in flight
  // and a rejected move stay off the card — the board locks while sending,
  // and a rejection is a sound, not a status.)
  if (ownSeat && !map[ownSeat]) {
    if (online.joinError) {
      map[ownSeat] = { kind: 'rejected', message: online.joinError };
    } else if (online.connStatus === 'reconnecting' || online.connStatus === 'disconnected') {
      map[ownSeat] = {
        kind: 'reconnecting',
        pendingCount: online.pendingCount,
        // A known-dead OS link reads as offline, not as a dropped socket.
        offline: online.linkDown,
      };
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
  online.linkDown,
  online.pendingCount,
]);

// Reactions, attributed to the sender's card: invert the sync's seat→
// account map once, group incoming by seat. Unresolvable items (engine
// banter with no sender, left seats) keep the legacy top-strip dock below —
// never dropped, never pinned on the wrong card.
const groupedReactions = useMemo(() => {
  if (type !== 'online') return { bySeat: {}, fallback: [] };
  const userIdToSeat: Record<string, string> = {};
  for (const [seatId, userId] of Object.entries(online.playerUserIds ?? {})) {
    userIdToSeat[userId] = seatId;
  }
  return groupReactionsBySeat(reactions.incoming, userIdToSeat);
}, [type, reactions.incoming, online.playerUserIds]);



// Seat miss: sync arrived but neither your id nor name matches a seat
// (changed identity mid-flow). Never silently play as someone else — the
// seat resolves as soon as the ids line up, and Back frees the screen
// meanwhile (see handleBackPress). The rejoin pump lives in useOnlineGame
// (single owner: same cooldown + attempt budget as every other rejoin path),
// so this screen only READS the seat state. No banner: there is no seat to
// hang an indicator on until the resync lands.
// (No effect here by design — see the hook's seat-miss pump.)

// A server-rejected move is sound-only: the board already rolled the move
// back, so the illegal-move click is the instant feedback (this matches the
// local illegal paths below, which never toast either).
const lastActionErrorNonce = useRef<number | null>(null);
useEffect(() => {
  if (type !== 'online' || !online.actionError) return;
  if (lastActionErrorNonce.current === online.actionError.nonce) return;
  lastActionErrorNonce.current = online.actionError.nonce;
  void playIllegalMoveSound();
}, [type, online.actionError]);

// Grace/AFK arming is soundless by default — yet the addressee is by
// definition not looking (away, idle, backgrounded). One notify chime per
// newly-away seat / fresh warning; the card countdown carries the rest.
const seenGraceKeysRef = useRef<Set<string>>(new Set());
const seenAfkKeyRef = useRef<string | null>(null);
useEffect(() => {
  if (type !== 'online') return;
  const keys = Object.keys(online.opponentGrace);
  const fresh = keys.filter((k) => !seenGraceKeysRef.current.has(k));
  seenGraceKeysRef.current = new Set(keys);
  const afkKey = online.afkWarning
    ? `${online.afkWarning.playerId ?? ''}:${online.afkWarning.afkEndsAt}`
    : null;
  const afkFresh = afkKey !== null && afkKey !== seenAfkKeyRef.current;
  seenAfkKeyRef.current = afkKey;
  if (fresh.length > 0 || afkFresh) void playNotifySound();
}, [type, online.opponentGrace, online.afkWarning]);

// A queued move the transport discarded after the board showed it: rolled
// back by the hook already, announced here with words (no illegal-move
// click — the move was never illegal, just never sent).
const lastDropNonce = useRef<number | null>(null);
useEffect(() => {
  if (type !== 'online' || !online.dropNotice) return;
  if (lastDropNonce.current === online.dropNotice.nonce) return;
  lastDropNonce.current = online.dropNotice.nonce;
  toast.show(online.dropNotice.message);
}, [type, online.dropNotice]);



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
  // 1v1 subtitle badge (P5.2): the named opponent's frozen premium flag.
  const opponentIsPremium =
    type === 'online' &&
    opponentAccountForResult != null &&
    (online.premiumUserIds ?? []).includes(opponentAccountForResult.userId);

  // Board-relative drag position for the ghost preview, reduced to a
  // snapped-slot STRING key. The raw computation below is trivial (rect
  // reads + a 64-cell scan), but the key is value-compared: same-slot
  // pointer motion keeps the memoized board — and its BFS legality
  // check — asleep instead of rebuilding ~300 views per touch event.
  let dragSlotRaw: WallCoord | null = null;
  if (wallDrag) {
    const pt = toBoardPoint(wallDrag.pageX, wallDrag.pageY);
    if (pt && isInsideBoard(pt.boardSize, pt.x, pt.y)) {
      const s = nearestWallSlot(
        pt.boardSize,
        pt.x,
        pt.y,
        boardRim(skin.frameBorderWidth),
        skin.cellGap
      );
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
      style={[
        styles.container,
        skin.pageBackground ? { backgroundColor: skin.pageBackground } : null,
      ]}
    >
      {/* Skin page texture: full-bleed table/frost/vignette behind everything. */}
      {skin.pageTexture && <SkinBackdrop texture={skin.pageTexture} />}
      {/* Status strip follows the skin page so no theme bar cuts the table. */}
      <StatusBar
        barStyle={
          skin.pageBackground
            ? skin.id === 'walnut'
              ? 'light-content'
              : 'dark-content'
            : THEME.mode === 'dark'
              ? 'light-content'
              : 'dark-content'
        }
        backgroundColor={skin.pageBackground ?? THEME.colors.backgroundCard}
      />

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
      {/* Chess.com top header: Back, title, and settings/connection */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenterBrand}>
          <View style={[styles.headerOrbDot, { backgroundColor: THEME.colors.primary }]} />
          <Text style={styles.headerTitle}>
            DuoOrb
          </Text>
        </View>

        <View style={styles.headerRight}>
          {type === 'online' ? (
            <View style={styles.connStatusWrap}>
              <Feather
                name={online.connStatus === 'connected' ? 'wifi' : 'wifi-off'}
                size={18}
                color={online.connStatus === 'connected' ? THEME.colors.tertiary : THEME.colors.error}
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setOptionsOpen(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Game options"
            >
              <Feather name="settings" size={20} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Opponent Zone: Bot Cutout + Speech Bubble + Top Right Stats for AI, or PlayerStrip for online/local */}
      <View style={styles.sideWrap}>
      {reactionsVisible && (
        <ReactionDock items={groupedReactions.fallback} side="top" onDone={reactions.dismiss} surface={hudSurface} />
      )}
      {type === 'ai' && personality ? (
        (() => {
          const botPlayer = state.players.find((_, i) => i !== humanIdx);
          const isBotActive = state.currentPlayerIndex !== humanIdx;
          const botBall = botPlayer ? playerColor(1 - humanIdx, botPlayer.color) : personality.color;
          const botTimer = botPlayer ? timers?.[botPlayer.id] : undefined;

          return (
            <View style={styles.botHeroRow}>
              {/* Bot cutout on left */}
              <View style={styles.botAvatarWrap}>
                <BotAvatar avatarKey={personality.avatarKey} color={botBall} size={58} noBg />
              </View>

              {/* Bot Speech Bubble in center */}
              {botDialogue.text ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={botDialogue.dismiss}
                  style={styles.botSpeechBubble}
                >
                  <View style={styles.bubbleTail} />
                  <Text style={styles.botSpeechText} numberOfLines={2}>
                    {botDialogue.text}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1 }} />
              )}

              {/* Bot stats on top right: remaining walls + clock (stacked in one column) */}
              {botPlayer && (
                <View style={styles.botHeroRightStats}>
                  <View style={styles.statWallsChip}>
                    <WallIcon size={14} color={botBall} />
                    <Text style={styles.statWallsText}>
                      {botPlayer.wallsRemaining}
                    </Text>
                  </View>

                  {botTimer !== undefined && (
                    <View style={[styles.matchTimerBox, isBotActive && styles.matchTimerBoxActive]}>
                      <MaterialCommunityIcons
                        name="timer-outline"
                        size={14}
                        color={isBotActive ? THEME.colors.primary : THEME.colors.textMuted}
                      />
                      <Text style={[styles.matchTimerText, isBotActive && styles.matchTimerTextActive]}>
                        {formatTimer(botTimer)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })()
      ) : (
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
            ratings={seatRatings}
            countryFlags={seatCountryFlags}
            compact
            grid={splitActive}
            bonus={lastBonus}
            seatStatus={onlineSeatStatus}
            seatPremium={seatPremium}
            botAvatarKeyBySeat={botAvatarKeyBySeat}
            reactionsBySeat={groupedReactions.bySeat}
            onReactionDone={reactions.dismiss}
            onPressPlayer={handleOpponentPress}
            surface={hudSurface}
          />
        </View>
      )}
      </View>
      </View>

      {/* Board + bottom packed with zero gaps, sized to fit the screen. */}
      <View
        style={[
          styles.boardWrap,
          type === 'online' &&
            online.inputLocked &&
            online.connStatus !== 'connected' &&
            styles.boardDimmed,
        ]}
      >
        <View
          ref={anchorRef}
          collapsable={false}
          onLayout={(e) => {
            measureAnchor();
            const { width } = e.nativeEvent.layout;
            setAnchorW((prev) => (Math.abs(prev - width) > 1 ? width : prev));
          }}
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
            interactive={
              (humanTurn || canPremove) &&
              !wallDrag &&
              viewingStep === null &&
              !(type === 'online' && online.inputLocked)
            }
            moveMark={hintMove ? { to: hintMove, color: '#10B981', solid: false } : null}
            moveHintColor={wallDrag ? trayColor : hintColor}
            premoveMarks={viewingStep !== null ? EMPTY_PREMOVE_MARKS : premoveMarks}
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

        {/* Bottom: your card + wall inventory */}
        <View
          style={styles.bottomBar}
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout;
            setBottomH((prev) => (Math.abs(prev - height) > 1 ? height : prev));
          }}
        >
          {type === 'ai' ? (
            (() => {
              const humanPlayer = state.players[humanIdx];
              if (!humanPlayer) return null;

              const isHumanActive = state.currentPlayerIndex === humanIdx;
              const humanBall = playerColor(humanIdx, humanPlayer.color);
              const humanTimer = timers?.[humanPlayer.id];

              return (
                <View style={styles.humanPlayerRow}>
                  {/* Human Identity (Left) */}
                  <View style={styles.humanIdentityLeft}>
                    <View style={[styles.humanAvatarDot, { backgroundColor: humanBall }]}>
                      <Text style={styles.humanAvatarInitial}>
                        {(humanPlayer.displayName || 'Y').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.humanPlayerName} numberOfLines={1}>
                      {humanPlayer.displayName || 'You'}
                    </Text>
                    {isHumanActive && <View style={[styles.botTurnDot, { backgroundColor: humanBall }]} />}
                  </View>

                  {/* Human Clock (Right) */}
                  {humanTimer !== undefined && (
                    <View style={[styles.matchTimerBox, isHumanActive && styles.matchTimerBoxActive]}>
                      <MaterialCommunityIcons
                        name="timer-outline"
                        size={15}
                        color={isHumanActive ? THEME.colors.primary : THEME.colors.textMuted}
                      />
                      <Text style={[styles.matchTimerText, isHumanActive && styles.matchTimerTextActive]}>
                        {formatTimer(humanTimer)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()
          ) : bottomStripState ? (
            <View pointerEvents={wallDrag ? 'none' : 'auto'}>
              <PlayerStrip
                state={bottomStripState}
                timers={timers}
                ratings={seatRatings}
                countryFlags={seatCountryFlags}
                bonus={lastBonus}
                hideWallsBadge={!splitActive}
                grid={splitActive}
                hideWallsForPlayerId={splitActive ? seatPlayer?.id : undefined}
                seatStatus={onlineSeatStatus}
                seatPremium={seatPremium}
                botAvatarKeyBySeat={botAvatarKeyBySeat}
                reactionsBySeat={groupedReactions.bySeat}
                onReactionDone={reactions.dismiss}
                onPressPlayer={splitActive ? handleBottomGridPress : undefined}
                surface={hudSurface}
              />
            </View>
          ) : null}
          {/* Fixed slot: the inventory stays visible every turn */}
          {!isCompleted && (
            <View style={styles.traySlot}>
              {reactionsVisible && (
                <ReactionDock
                  items={reactions.outgoing}
                  side="bottom"
                  onDone={reactions.dismissOutgoing}
                  surface={hudSurface}
                />
              )}
              {trayPlayer && (
              <WallTray
                color={trayColor}
                count={trayPlayer.wallsRemaining}
                held={wallDrag?.orientation ?? null}
                disabled={!(humanTurn || (canPremove && queueOn)) || viewingStep !== null}
                swapVisuals={swapWallVisuals}
                onDragStart={handleTrayStart}
                onDragMove={handleTrayMove}
                onDragEnd={handleTrayEnd}
              />
              )}
            </View>
          )}
          {(socketLive || aiSparring) && matchLive && chatTrayOpen && (
            <ReactionTray onSend={handleReactionSend} surface={hudSurface} />
          )}
        </View>
      </View>

      {/* Chess.com style bottom action dock */}
      <View style={styles.bottomDock}>
        {isCompleted ? (
          <>
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setOptionsOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Options</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setShowGameOver(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="file-document-outline" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Summary</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockReviewBtn}
              onPress={() => void handleAnalyzePress()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SmoothStar size={15} color="#FFFFFF" />
              <Text style={styles.dockReviewText}>Review</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, (viewingStep ?? totalSteps) <= 0 && styles.dockItemDisabled]}
              disabled={(viewingStep ?? totalSteps) <= 0}
              onPress={() => {
                setReplaying(false);
                const cur = viewingStep ?? totalSteps;
                if (cur > 0) setViewingStep(cur - 1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-left" size={21} color={(viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: (viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockLabelColor }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, viewingStep === null && styles.dockItemDisabled]}
              disabled={viewingStep === null}
              onPress={() => {
                setReplaying(false);
                if (viewingStep !== null) {
                  if (viewingStep < totalSteps - 1) {
                    setViewingStep(viewingStep + 1);
                  } else {
                    setViewingStep(null);
                  }
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-right" size={21} color={viewingStep === null ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: viewingStep === null ? dockDisabledColor : dockLabelColor }]}>Forward</Text>
            </TouchableOpacity>
          </>
        ) : type === 'ai' ? (
          <>
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setOptionsOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Options</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockItem}
              onPress={handleHintPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="lightbulb-on-outline" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Hint</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockItem}
              disabled={!undoAvailable}
              onPress={handleUndoPress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="undo-variant" size={21} color={undoAvailable ? dockIconColor : dockDisabledColor} />
              <Text style={[styles.dockLabel, { color: undoAvailable ? dockLabelColor : dockDisabledColor }]}>
                Undo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, (viewingStep ?? totalSteps) <= 0 && styles.dockItemDisabled]}
              disabled={(viewingStep ?? totalSteps) <= 0}
              onPress={() => {
                setReplaying(false);
                const cur = viewingStep ?? totalSteps;
                if (cur > 0) setViewingStep(cur - 1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-left" size={21} color={(viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: (viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockLabelColor }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, viewingStep === null && styles.dockItemDisabled]}
              disabled={viewingStep === null}
              onPress={() => {
                setReplaying(false);
                if (viewingStep !== null) {
                  if (viewingStep < totalSteps - 1) {
                    setViewingStep(viewingStep + 1);
                  } else {
                    setViewingStep(null);
                  }
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-right" size={21} color={viewingStep === null ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: viewingStep === null ? dockDisabledColor : dockLabelColor }]}>Forward</Text>
            </TouchableOpacity>
          </>
        ) : type === 'online' ? (
          <>
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setOptionsOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Options</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setChatTrayOpen((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="message-text-outline" size={21} color={chatTrayOpen ? THEME.colors.primary : dockIconColor} />
              <Text style={[styles.dockLabel, { color: chatTrayOpen ? THEME.colors.primary : dockLabelColor }]}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, (viewingStep ?? totalSteps) <= 0 && styles.dockItemDisabled]}
              disabled={(viewingStep ?? totalSteps) <= 0}
              onPress={() => {
                setReplaying(false);
                const cur = viewingStep ?? totalSteps;
                if (cur > 0) setViewingStep(cur - 1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-left" size={21} color={(viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: (viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockLabelColor }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, viewingStep === null && styles.dockItemDisabled]}
              disabled={viewingStep === null}
              onPress={() => {
                setReplaying(false);
                if (viewingStep !== null) {
                  if (viewingStep < totalSteps - 1) {
                    setViewingStep(viewingStep + 1);
                  } else {
                    setViewingStep(null);
                  }
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-right" size={21} color={viewingStep === null ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: viewingStep === null ? dockDisabledColor : dockLabelColor }]}>Forward</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.dockItem}
              onPress={() => setOptionsOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={21} color={dockIconColor} />
              <Text style={[styles.dockLabel, { color: dockLabelColor }]}>Options</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, (viewingStep ?? totalSteps) <= 0 && styles.dockItemDisabled]}
              disabled={(viewingStep ?? totalSteps) <= 0}
              onPress={() => {
                setReplaying(false);
                const cur = viewingStep ?? totalSteps;
                if (cur > 0) setViewingStep(cur - 1);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-left" size={21} color={(viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: (viewingStep ?? totalSteps) <= 0 ? dockDisabledColor : dockLabelColor }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockItem, viewingStep === null && styles.dockItemDisabled]}
              disabled={viewingStep === null}
              onPress={() => {
                setReplaying(false);
                if (viewingStep !== null) {
                  if (viewingStep < totalSteps - 1) {
                    setViewingStep(viewingStep + 1);
                  } else {
                    setViewingStep(null);
                  }
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="chevron-right" size={21} color={viewingStep === null ? dockDisabledColor : dockIconColor} />
              <Text style={[styles.dockLabel, { color: viewingStep === null ? dockDisabledColor : dockLabelColor }]}>Forward</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Stitch resign confirm: dimmed overlay, white card, red icon. */}
      <Modal visible={resignOpen} transparent animationType="fade">
        <SafeAreaView style={styles.resignOverlay} edges={['top', 'bottom']}>
          <View
            style={[
              styles.resignCard,
              hudSurface && {
                backgroundColor: hudSurface.card,
                borderColor: hudSurface.border,
              },
            ]}
          >
            <View style={styles.resignIconCircle}>
              <Feather name="flag" size={28} color={THEME.colors.error} />
            </View>
            <Text style={[styles.resignTitle, hudSurface && { color: hudSurface.ink }]}>
              {t('game.resignTitle')}
            </Text>
            <Text style={[styles.resignDesc, hudSurface && { color: hudSurface.subInk }]}>
              {type === 'online'
                ? t('game.resignDescOnline')
                : t('game.resignDescLocal')}
            </Text>
            <View style={styles.resignActions}>
              <TouchableOpacity
                style={styles.resignConfirm}
                onPress={() => {
                  setResignOpen(false);
                  handleResign();
                }}
              >
                <Text style={styles.resignConfirmText}>{t('game.resignConfirm')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resignCancel}
                onPress={() => setResignOpen(false)}
              >
                <Text style={styles.resignCancelText}>{t('game.resignCancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Chess.com style In-Game Options Modal */}
      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <SafeAreaView style={styles.optionsOverlay} edges={['top', 'bottom']}>
          <View style={styles.optionsCard}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>Match Options</Text>
              <TouchableOpacity onPress={() => setOptionsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={20} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsList}>
              {type === 'ai' ? (
                isCompleted ? (
                  <>
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        handleRematch();
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <Feather name="refresh-cw" size={20} color={THEME.colors.primary} />
                        <Text style={[styles.optionRowText, { color: THEME.colors.primary }]}>Rematch</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        if (onSelectBots) {
                          onSelectBots();
                        } else {
                          onNewGame();
                        }
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <MaterialCommunityIcons name="robot-outline" size={20} color={THEME.colors.textPrimary} />
                        <Text style={styles.optionRowText}>Play vs Different Bot</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        void maybeShowPostMatchVideoAd('close_match').finally(onHome);
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <Feather name="log-out" size={20} color={THEME.colors.textSecondary} />
                        <Text style={styles.optionRowText}>Exit Match</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        handleRematch();
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <Feather name="rotate-ccw" size={20} color={THEME.colors.textPrimary} />
                        <Text style={styles.optionRowText}>Restart</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    {canResign && (
                      <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                          setOptionsOpen(false);
                          setResignOpen(true);
                        }}
                      >
                        <View style={styles.optionRowLeft}>
                          <Feather name="flag" size={20} color={THEME.colors.error} />
                          <Text style={[styles.optionRowText, { color: THEME.colors.error }]}>Resign Match</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        if (onSelectBots) {
                          onSelectBots();
                        } else {
                          onNewGame();
                        }
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <MaterialCommunityIcons name="robot-outline" size={20} color={THEME.colors.textPrimary} />
                        <Text style={styles.optionRowText}>Play vs Different Bot</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        onHome();
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <Feather name="log-out" size={20} color={THEME.colors.textSecondary} />
                        <Text style={styles.optionRowText}>Exit to Menu</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )
              ) : (
                <>
                  {isCompleted && (
                    <>
                      <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                          setOptionsOpen(false);
                          handleRematch();
                        }}
                      >
                        <View style={styles.optionRowLeft}>
                          <Feather name="refresh-cw" size={20} color={THEME.colors.primary} />
                          <Text style={[styles.optionRowText, { color: THEME.colors.primary }]}>Rematch</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => {
                          setOptionsOpen(false);
                          void maybeShowPostMatchVideoAd('new_match').finally(onNewGame);
                        }}
                      >
                        <View style={styles.optionRowLeft}>
                          <Feather name="play" size={20} color={THEME.colors.textPrimary} />
                          <Text style={styles.optionRowText}>New Game</Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                      </TouchableOpacity>
                    </>
                  )}

                  {!isCompleted && canResign && (
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsOpen(false);
                        setResignOpen(true);
                      }}
                    >
                      <View style={styles.optionRowLeft}>
                        <Feather name="flag" size={20} color={THEME.colors.error} />
                        <Text style={[styles.optionRowText, { color: THEME.colors.error }]}>Resign Match</Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      setOptionsOpen(false);
                      handleBackPress();
                    }}
                  >
                    <View style={styles.optionRowLeft}>
                      <Feather name="log-out" size={20} color={THEME.colors.textSecondary} />
                      <Text style={styles.optionRowText}>{isCompleted ? 'Exit Match' : 'Exit to Menu'}</Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={THEME.colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Held wall follows the finger — wears the skin like tray/ghost:
          sharp rectangle on walnut, capsule elsewhere. */}
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

      <Modal visible={finishModal !== null} transparent animationType="fade">
        <SafeAreaView style={styles.resignOverlay} edges={['top', 'bottom']}>
          <View style={styles.finishCard}>
            <View style={styles.finishIconCircle}>
              <Feather name="award" size={30} color={THEME.colors.assessmentInaccuracy} />
            </View>
            <Text style={styles.finishTitle}>
              {finishModal?.place === 1 ? t('game.place1st') : t('game.placeNth', { place: finishModal?.place ?? '' })}
            </Text>
            <Text style={styles.finishDesc}>
              {t('game.finishDesc')}
            </Text>
            <TouchableOpacity style={styles.finishPrimary} onPress={() => setFinishModal(null)}>
              <Text style={styles.finishPrimaryText}>{t('game.keepWatching')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishSecondary} onPress={leaveFinishedAndHome}>
              <Text style={styles.finishSecondaryText}>{t('game.leaveMatch')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Blocking join/seat states (I1/I11/I12): without these a failed join
          with no seat rendered nothing over a phantom playable board, a
          seat-less sync played silently as the wrong seat, and a rematch
          switch sat on a stale result screen with no progress signal. */}
      {type === 'online' && online.joinError && !online.gameState && !offlineSnapshot && (
        <View style={styles.blockingOverlay}>
          <Feather name="alert-circle" size={28} color={THEME.colors.danger} />
          <Text style={styles.blockingTitle}>{online.joinError}</Text>
          <Text style={styles.blockingSub}>{t('game.searchAgainBack')}</Text>
        </View>
      )}
      {type === 'online' &&
        !online.joinError &&
        online.gameState?.status === 'IN_PROGRESS' &&
        !online.myPlayerId && (
          <View style={styles.blockingOverlay}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.blockingTitle}>{t('game.findingSeat')}</Text>
            <Text style={styles.blockingSub}>{t('game.inputResumes')}</Text>
          </View>
        )}
      {type === 'online' &&
        onlineGameId &&
        online.gameState &&
        online.gameState.gameId !== onlineGameId &&
        online.isSyncing && (
          <View style={styles.blockingOverlay}>
            <ActivityIndicator size="large" color={THEME.colors.primary} />
            <Text style={styles.blockingTitle}>{t('game.joiningMatch')}</Text>
          </View>
        )}

      <GameOverModal
        visible={showGameOver}
        state={state}
        initialState={initialState}
        type={type}
        moveCounts={localMoveCounts}
        onOpenPremium={() => {
          setPremiumSource('gameover');
          setPremiumOpen(true);
        }}
        endReason={type === 'online' ? online.gameEndedResult?.reason ?? null : null}
        isRanked={type === 'online'}
        botPersonality={personality}
        ratingDelta={type === 'online' && identity ? online.gameEndedResult?.ratingChanges?.[identity.userId]?.delta : undefined}
        ratingAfter={type === 'online' && identity ? online.gameEndedResult?.ratingChanges?.[identity.userId]?.after : undefined}
        opponentName={
          isMultiplayer
            ? undefined
            : type === 'ai'
            ? personality?.name ?? `AI - ${aiDifficulty.charAt(0).toUpperCase()}${aiDifficulty.slice(1)}`
            : topList[0]?.displayName || 'Opponent'
        }
        isWinner={userWon}
        botStarsEarned={type === 'ai' ? botStarsEarned : null}
        botStarHint={botStarsEarned !== null && botStarsEarned < 3 ? t('gameover.starHint') : null}
        myPlayerId={
          type === 'online'
            ? online.myPlayerId
            : type === 'ai'
            ? state.players[humanIdx]?.id ?? null
            : null
        }
        onRematch={handleRematch}
        showNewGame={(type === 'online' && onlineSource !== 'room') || type === 'ai'}
        onNewGame={() => {
          setShowGameOver(false);
          if (type === 'ai' && onSelectBots) {
            onSelectBots();
          } else {
            void maybeShowPostMatchVideoAd('new_match').finally(onNewGame);
          }
        }}
        onReplay={enterReplay}
        opponentUserId={opponentAccountForResult?.userId ?? null}
        opponentIsPremium={opponentIsPremium}
        seatPremium={seatPremium}
        onViewOpponentProfile={
          opponentAccountForResult
            ? () => {
                setShowGameOver(false);
                setProfilePlayer(opponentAccountForResult);
              }
            : undefined
        }
        onAnalyze={handleAnalyzePress}
        onHome={() => {
          setShowGameOver(false);
          void maybeShowPostMatchVideoAd('close_match').finally(onHome);
        }}
        onClose={() => setShowGameOver(false)}
      />
      <RewardSheet
        visible={rewardOpen}
        busy={rewardBusy}
        error={rewardError}
        onWatch={handleWatchAd}
        onPremium={() => {
          if (rewardBusy) return;
          setRewardOpen(false);
          setRewardError(null);
          setPremiumSource('analysis');
          setPremiumOpen(true);
        }}
        onClose={() => {
          if (!rewardBusy) setRewardOpen(false);
        }}
      />
      <RewardSheet
        visible={undoSheetOpen}
        busy={undoBusy}
        error={undoError}
        variant="undo"
        onWatch={handleUndoWatch}
        onPremium={() => {
          if (undoBusy) return;
          setUndoSheetOpen(false);
          setUndoError(null);
          setPremiumSource('undo');
          setPremiumOpen(true);
        }}
        onClose={() => {
          if (!undoBusy) setUndoSheetOpen(false);
        }}
      />
      <PremiumSheet
        visible={premiumOpen}
        entry={premiumSource}
        onClose={() => setPremiumOpen(false)}
        onDone={() => {
          setPremiumOpen(false);
          void refreshPremium();
        }}
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
                ? t('game.rematchOffered')
                : t('game.waitingOpponent')}
            </Text>
              {online.rematchOffered && !rematchIncomingDismissed && (
                <>
                  <TouchableOpacity
                    style={styles.rematchDeclineBtn}
                    onPress={() => {
                      online.declineRematch();
                      setRematchIncomingDismissed(true);
                    }}
                  >
                    <Text style={styles.rematchDeclineText}>{t('game.decline')}</Text>
                  </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rematchAcceptBtn}
                  onPress={() => {
                    setRematchIncomingDismissed(true);
                    handleRematch();
                  }}
                >
                  <Text style={styles.rematchAcceptText}>{t('game.accept')}</Text>
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
            onAnalyzeGame={() => {}}
            inGame
          />
        </View>
      )}
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    justifyContent: 'space-between',
    // No text selection anywhere while dragging walls around the board.
    userSelect: 'none',
    ...(Platform.OS === 'web' ? { overflowY: 'auto' as any } : {}),
  },
  header: {
    height: 48,
    backgroundColor: THEME.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerCenterBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerOrbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 0.3,
  },
  headerRight: {
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  connStatusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  botHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 8,
    minHeight: 66,
  },
  botAvatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  botSpeechBubble: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    position: 'relative',
    justifyContent: 'center',
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
  botSpeechText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '600',
    color: '#161512',
  },
  botHeroRightStats: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  statWallsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 25,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceMuted,
    gap: 4,
  },
  statWallsText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  matchTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 25,
    borderRadius: 6,
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 4,
  },
  matchTimerBoxActive: {
    borderColor: THEME.colors.primary,
  },
  matchTimerText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  matchTimerTextActive: {
    color: THEME.colors.textPrimary,
    fontWeight: '800',
  },
  humanPlayerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  humanIdentityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  humanAvatarDot: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  humanAvatarInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  humanPlayerName: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    maxWidth: 120,
  },
  botTurnDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.outlineVariant,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 8,
  },
  dockItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
    gap: 2,
  },
  dockItemDisabled: {
    opacity: 0.35,
  },
  dockLabel: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  dockReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dockReviewText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  optionsCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.outlineVariant,
  },
  optionsTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfaceMuted,
  },
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionRowText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
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
    overflow: 'visible',
    zIndex: 30,
  },
  boardWrap: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  // Locked while a move is unconfirmed AND the transport is down: the board
  // looks live but every tap is dropped. Online-but-slow moves dim nothing —
  // a sub-second flicker per move would be worse than the lock it signals.
  boardDimmed: {
    opacity: 0.9,
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
    gap: 8,
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
  resignButtonHalf: {
    flex: 1,
    width: 'auto',
  },
  undoButton: {
    flex: 1,
    width: 'auto',
    backgroundColor: THEME.colors.surfacePrimaryTint,
    borderColor: THEME.colors.surfacePrimaryTintBorder,
  },
  undoButtonDisabled: {
    opacity: 0.45,
  },
  undoText: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    padding: 24,
    maxWidth: 320,
    width: '100%',
    alignItems: 'center',
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
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
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
    color: THEME.colors.onSurface,
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
  replayActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.surfaceHairline,
  },
  replayActionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  replayActionText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.onSurface,
  },
  disabled: {
    opacity: 0.4,
  },
  dragChip: {
    position: 'absolute',
    zIndex: 50,
    transform: [{ scale: 1.06 }],
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
  },
  rematchToastText: { flex: 1, fontFamily: THEME.fonts.semiBold, fontSize: 13, color: THEME.colors.inverseLabel },
  rematchDeclineBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: THEME.colors.surfaceMuted },
  rematchDeclineText: { fontFamily: THEME.fonts.semiBold, fontSize: 12, color: THEME.colors.textSecondaryStrong },
  rematchAcceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: THEME.colors.primary },
  rematchAcceptText: { fontFamily: THEME.fonts.bold, fontSize: 12, color: THEME.colors.onPrimary },
  // Blocking join/seat states: full-screen, input-eating, above the board
  // but below native modals (render order). A spinner for waits, an icon
  // for terminal failures — never a playable-looking board underneath.
  blockingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
    zIndex: 5,
  },
  blockingTitle: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.onSurface,
    textAlign: 'center',
  },
  blockingSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
});
