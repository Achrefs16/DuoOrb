import {
  RULESET_CENTER_V1,
  RULESET_CLASSIC_2P,
  RULESET_CLASSIC_4P,
  RULESET_RACE_V1,
  playerCountForMode,
  startingWallsForMode,
} from './constants.js';
import { isLegalMove } from './movement.js';
import { isGoalCell } from './pathfinding.js';
import {
  ActionResult,
  CellCoord,
  GameAction,
  GameMode,
  GameState,
  Placement,
  PlayerState,
  RecordedAction,
  Wall,
  WallCoord,
} from './types.js';
import { validateWallPlacement } from './walls.js';

export interface CreateGameOptions {
  gameId?: string;
  mode?: GameMode;
  playerNames?: string[];
  rulesetVersion?: string;
  /** Walls per player — defaults to startingWallsForMode(mode). */
  wallsEach?: number;
}

export const PLAYER_COLORS_DEFAULT = [
  '#2563EB', // Player 1 — strong blue
  '#E5484D', // Player 2 — coral red
  '#0E9F6E', // Player 3 — green
  '#D9930D', // Player 4 — amber
];

/**
 * Creates the initial state for a new game.
 */
export function createInitialState(options: CreateGameOptions = {}): GameState {
  const mode: GameMode = options.mode ?? '2p';
  const gameId = options.gameId ?? `game-${Date.now()}`;
  const rulesetVersion =
    options.rulesetVersion ??
    (mode === '4p'
      ? RULESET_CLASSIC_4P
      : mode === '2p'
      ? RULESET_CLASSIC_2P
      : mode === 'center2' || mode === 'center3'
      ? RULESET_CENTER_V1
      : RULESET_RACE_V1);
  const count = playerCountForMode(mode);
  const wallsEach = options.wallsEach ?? startingWallsForMode(mode);
  const defaultNames = (n: number) =>
    Array.from({ length: n }, (_, i) => `Player ${i + 1}`);
  const playerNames = options.playerNames ?? defaultNames(count);

  const makePlayer = (
    index: number,
    position: { row: number; col: number },
    goalDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT'
  ): PlayerState => ({
    id: `p${index + 1}`,
    index,
    displayName: playerNames[index] ?? `Player ${index + 1}`,
    position,
    wallsRemaining: wallsEach,
    goalDirection,
    color: PLAYER_COLORS_DEFAULT[index % PLAYER_COLORS_DEFAULT.length],
    status: 'ACTIVE',
    place: null,
  });

  let players: PlayerState[];

  if (mode === '2p') {
    players = [
      {
        id: 'p1',
        index: 0,
        displayName: playerNames[0] ?? 'Player 1',
        position: { row: 8, col: 4 }, // Center bottom
        wallsRemaining: wallsEach,
        goalDirection: 'TOP',
        color: PLAYER_COLORS_DEFAULT[0],
        status: 'ACTIVE',
        place: null,
      },
      {
        id: 'p2',
        index: 1,
        displayName: playerNames[1] ?? 'Player 2',
        position: { row: 0, col: 4 }, // Center top
        wallsRemaining: wallsEach,
        goalDirection: 'BOTTOM',
        color: PLAYER_COLORS_DEFAULT[1],
        status: 'ACTIVE',
        place: null,
      },
    ];
  } else if (mode === '4p') {
    players = [
      {
        id: 'p1',
        index: 0,
        displayName: playerNames[0] ?? 'Player 1',
        position: { row: 8, col: 4 }, // Bottom
        wallsRemaining: wallsEach,
        goalDirection: 'TOP',
        color: PLAYER_COLORS_DEFAULT[0],
        status: 'ACTIVE',
        place: null,
      },
      {
        id: 'p2',
        index: 1,
        displayName: playerNames[1] ?? 'Player 2',
        position: { row: 0, col: 4 }, // Top
        wallsRemaining: wallsEach,
        goalDirection: 'BOTTOM',
        color: PLAYER_COLORS_DEFAULT[1],
        status: 'ACTIVE',
        place: null,
      },
      {
        id: 'p3',
        index: 2,
        displayName: playerNames[2] ?? 'Player 3',
        position: { row: 4, col: 0 }, // Left
        wallsRemaining: wallsEach,
        goalDirection: 'RIGHT',
        color: PLAYER_COLORS_DEFAULT[2],
        status: 'ACTIVE',
        place: null,
      },
      {
        id: 'p4',
        index: 3,
        displayName: playerNames[3] ?? 'Player 4',
        position: { row: 4, col: 8 }, // Right
        wallsRemaining: wallsEach,
        goalDirection: 'LEFT',
        color: PLAYER_COLORS_DEFAULT[3],
        status: 'ACTIVE',
        place: null,
      },
    ];
  } else if (mode === 'center2' || mode === 'center3') {
    // Center Rush with 2-3 players: opposite edges race for the center.
    const starts: Array<{ pos: { row: number; col: number }; goal: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' }> =
      mode === 'center2'
        ? [
            { pos: { row: 8, col: 4 }, goal: 'TOP' },
            { pos: { row: 0, col: 4 }, goal: 'BOTTOM' },
          ]
        : [
            { pos: { row: 8, col: 4 }, goal: 'TOP' },
            { pos: { row: 0, col: 4 }, goal: 'BOTTOM' },
            { pos: { row: 4, col: 0 }, goal: 'RIGHT' },
          ];
    players = starts.map((s, i) => makePlayer(i, s.pos, s.goal));
  } else {
    // Race: 2-4 players, everyone starts spread across the bottom row and
    // races for any cell of the top row. Movement, walls and turns unchanged.
    const count = mode === 'race3' ? 3 : mode === 'race4' ? 4 : 2;
    const startCols = count === 2 ? [2, 6] : count === 3 ? [1, 4, 7] : [1, 3, 5, 7];
    players = startCols.map((col, i) => ({
      id: `p${i + 1}`,
      index: i,
      displayName: playerNames[i] ?? `Player ${i + 1}`,
      position: { row: 8, col },
      wallsRemaining: wallsEach,
      goalDirection: 'TOP' as const,
      color: PLAYER_COLORS_DEFAULT[i % PLAYER_COLORS_DEFAULT.length],
      status: 'ACTIVE' as const,
      place: null as number | null,
    }));
  }

  const now = Date.now();

  return {
    rulesetVersion,
    gameId,
    mode,
    status: 'IN_PROGRESS',
    players,
    walls: [],
    currentPlayerIndex: 0,
    moveNumber: 1,
    lastMove: null,
    winnerId: null,
    history: [],
    placements: [],
    createdAt: now,
    startedAt: now,
    endedAt: null,
  };
}

export interface ActionMeta {
  timestamp?: number;
  clockRemainingMs?: number;
  /**
   * Authoritative actor for turn-independent actions (RESIGN). When set,
   * the resigner is this player even if it is not their turn — otherwise
   * an off-turn resign would crown the resigner by mistake.
   */
  actorId?: string;
}

/** Players still competing — finished players never receive turns. */
export function activePlayers(state: GameState): PlayerState[] {
  return state.players.filter((p) => p.status === 'ACTIVE');
}

/** Best (smallest) untaken place — earned by reaching the goal. */
export function bestRemainingPlace(state: GameState): number {
  const taken = new Set(state.placements.map((p) => p.place));
  for (let place = 1; place <= state.players.length; place++) {
    if (!taken.has(place)) return place;
  }
  return state.players.length;
}

/** Worst (largest) untaken place — assigned to forfeits, so quitting
 * early is never rewarded with a better place than playing on. */
export function worstRemainingPlace(state: GameState): number {
  const taken = new Set(state.placements.map((p) => p.place));
  for (let place = state.players.length; place >= 1; place--) {
    if (!taken.has(place)) return place;
  }
  return state.players.length;
}

/** Next ACTIVE player index round-robin after fromIdx (skips FINISHED). */
export function nextActiveIndex(players: PlayerState[], fromIdx: number): number {
  const total = players.length;
  for (let step = 1; step <= total; step++) {
    const idx = (fromIdx + step) % total;
    if (players[idx].status === 'ACTIVE') return idx;
  }
  return fromIdx;
}

/**
 * Multiplayer completion rule: an N-player match ends when N-1 players
 * have finished; the last remaining active player is auto-assigned the
 * final placement. 1v1 never uses this — it ends on the decisive action.
 */
export function shouldFinishMultiplayerGame(state: GameState): boolean {
  const total = state.players.length;
  if (total <= 2) return false;
  return state.placements.length >= total - 1;
}

interface FinishOutcome {
  players: PlayerState[];
  placements: Placement[];
  status: GameState['status'];
  winnerId: string | null;
  endedAt: number | null;
  currentPlayerIndex: number;
  /** Placement earned by the acting player (for broadcasts/history). */
  earnedPlace: number;
}

/**
 * Records players[playerIdx] finishing and either continues the game with
 * them removed from rotation, or — when only one active player remains —
 * auto-assigns that player the final place and completes the game.
 * Pure and replay-safe: re-derives everything from (players, placements).
 */
function applyFinish(
  state: GameState,
  playerIdx: number,
  method: 'GOAL' | 'FORFEIT',
  timestamp: number
): FinishOutcome {
  const place = method === 'GOAL' ? bestRemainingPlace(state) : worstRemainingPlace(state);
  let players = state.players.map((p, i) =>
    i === playerIdx ? { ...p, status: 'FINISHED' as const, place } : p
  );
  let placements: Placement[] = [...state.placements, { playerId: state.players[playerIdx].id, place }];

  if (shouldFinishMultiplayerGame({ ...state, placements })) {
    const lastIdx = players.findIndex((p) => p.status === 'ACTIVE');
    if (lastIdx >= 0) {
      const finalPlace = bestRemainingPlace({ ...state, placements });
      const lastId = players[lastIdx].id;
      players = players.map((p, i) =>
        i === lastIdx ? { ...p, status: 'FINISHED' as const, place: finalPlace } : p
      );
      placements = [...placements, { playerId: lastId, place: finalPlace }];
    }
    const first = placements.find((p) => p.place === 1);
    return {
      players,
      placements,
      status: 'COMPLETED',
      winnerId: first ? first.playerId : state.players[playerIdx].id,
      endedAt: timestamp,
      currentPlayerIndex: state.currentPlayerIndex,
      earnedPlace: place,
    };
  }

  return {
    players,
    placements,
    status: 'IN_PROGRESS',
    winnerId: null,
    endedAt: null,
    currentPlayerIndex: nextActiveIndex(players, playerIdx),
    earnedPlace: place,
  };
}

/**
 * Resignation cascade for matches without a server (AI / local review):
 * the resigner forfeits then every remaining ACTIVE seat forfeits in turn
 * order, so a human resignation finalizes the whole match at once as
 * their loss instead of leaving opponents playing on.
 * Pure — replays deterministically like any other action sequence.
 */
export function forfeitMatch(
  state: GameState,
  resignerId: string,
  timestamp?: number
): ActionResult<GameState> {
  const ts = timestamp ?? Date.now();
  let live = state;
  const first = applyAction(live, { type: 'RESIGN' }, { timestamp: ts, actorId: resignerId });
  if (!first.success) return first;
  live = first.state;
  if (live.status !== 'IN_PROGRESS') return { success: true, state: live };
  for (const p of live.players) {
    if (live.status !== 'IN_PROGRESS') break;
    if (p.id === resignerId || p.status !== 'ACTIVE') continue;
    const r = applyAction(live, { type: 'RESIGN' }, { timestamp: ts, actorId: p.id });
    if (!r.success) break;
    live = r.state;
  }
  return { success: true, state: live };
}

/**
 * Pure state transition function.
 * Applies a GameAction to a GameState and returns a brand new GameState or an error.
 */
export function applyAction(
  state: GameState,
  action: GameAction,
  meta: ActionMeta = {}
): ActionResult<GameState> {
  if (state.status !== 'IN_PROGRESS') {
    return {
      success: false,
      error: { code: 'GAME_NOT_IN_PROGRESS', message: 'Game is not in progress.' },
    };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return {
      success: false,
      error: { code: 'NOT_YOUR_TURN', message: 'Current player does not exist.' },
    };
  }

  const sequence = state.history.length + 1;
  const timestamp = meta.timestamp ?? Date.now();

  if (action.type === 'MOVE') {
    const to = action.to;
    if (!isLegalMove(state, currentPlayer.id, to)) {
      return {
        success: false,
        error: { code: 'ILLEGAL_MOVE', message: `Illegal move to (${to.row}, ${to.col}).` },
      };
    }

    const updatedPlayers = state.players.map((p, idx) =>
      idx === state.currentPlayerIndex ? { ...p, position: to } : p
    );

    // Goal detection runs on the destination alone: finished players are
    // removed from the board, so a freed goal cell is a normal winning
    // destination for whoever enters it next.
    const hasWon = isGoalCell(to, currentPlayer.goalDirection, state.mode);

    const recordedMove: RecordedAction = {
      sequence,
      playerId: currentPlayer.id,
      action,
      timestamp,
      clockRemainingMs: meta.clockRemainingMs,
    };

    // Head-to-head: a goal ends the match immediately (unchanged).
    if (state.players.length === 2) {
      const nextState: GameState = {
        ...state,
        players: updatedPlayers,
        currentPlayerIndex: hasWon
          ? state.currentPlayerIndex
          : nextActiveIndex(state.players, state.currentPlayerIndex),
        moveNumber: state.moveNumber + 1,
        status: hasWon ? 'COMPLETED' : 'IN_PROGRESS',
        winnerId: hasWon ? currentPlayer.id : null,
        endedAt: hasWon ? timestamp : null,
        lastMove: recordedMove,
        history: [...state.history, recordedMove],
      };

      return { success: true, state: nextState };
    }

    // Multiplayer: a goal means "this player has finished", not "the
    // match is over" — the game continues for the remaining actives.
    if (hasWon) {
      const finish = applyFinish(
        { ...state, players: updatedPlayers },
        state.currentPlayerIndex,
        'GOAL',
        timestamp
      );
      const nextState: GameState = {
        ...state,
        players: finish.players,
        placements: finish.placements,
        currentPlayerIndex: finish.currentPlayerIndex,
        moveNumber: state.moveNumber + 1,
        status: finish.status,
        winnerId: finish.winnerId,
        endedAt: finish.endedAt,
        lastMove: recordedMove,
        history: [...state.history, recordedMove],
      };

      return { success: true, state: nextState };
    }

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      currentPlayerIndex: nextActiveIndex(state.players, state.currentPlayerIndex),
      moveNumber: state.moveNumber + 1,
      status: 'IN_PROGRESS',
      winnerId: null,
      endedAt: null,
      lastMove: recordedMove,
      history: [...state.history, recordedMove],
    };

    return { success: true, state: nextState };
  }

  if (action.type === 'PLACE_WALL') {
    const wallCoord: WallCoord = action.wall;
    const wallError = validateWallPlacement(state, currentPlayer.id, wallCoord);
    if (wallError) {
      return { success: false, error: wallError };
    }

    const newWall: Wall = {
      ...wallCoord,
      placedByPlayerId: currentPlayer.id,
      sequence,
    };

    const updatedPlayers = state.players.map((p, idx) =>
      idx === state.currentPlayerIndex
        ? { ...p, wallsRemaining: p.wallsRemaining - 1 }
        : p
    );

    const recordedMove: RecordedAction = {
      sequence,
      playerId: currentPlayer.id,
      action,
      timestamp,
      clockRemainingMs: meta.clockRemainingMs,
    };

    const nextState: GameState = {
      ...state,
      players: updatedPlayers,
      walls: [...state.walls, newWall],
      currentPlayerIndex: nextActiveIndex(state.players, state.currentPlayerIndex),
      moveNumber: state.moveNumber + 1,
      lastMove: recordedMove,
      history: [...state.history, recordedMove],
    };

    return { success: true, state: nextState };
  }

  if (action.type === 'RESIGN' || action.type === 'TIMEOUT') {
    // The resigner is the authoritative actor when provided and still
    // active (off-turn resigns/forfeits); TIMEOUT always hits the side to
    // move unless the actor names an active player (disconnect forfeit).
    // A stale actor naming an already-finished player falls back to the
    // current player so a finished placement can never be overwritten.
    let actorIdx = state.currentPlayerIndex;
    if (meta.actorId) {
      const named = state.players.findIndex((p) => p.id === meta.actorId);
      if (action.type === 'RESIGN') {
        // An explicit resigner is always honored — including a finished
        // player, who is then rejected below with ALREADY_FINISHED.
        if (named >= 0) actorIdx = named;
      } else if (named >= 0 && state.players[named].status === 'ACTIVE') {
        actorIdx = named;
      }
    }
    const resigner = state.players[actorIdx] ?? currentPlayer;

    // A finished player cannot resign as an active player — they already
    // earned their placement and are spectating.
    if (action.type === 'RESIGN' && resigner.status === 'FINISHED') {
      return {
        success: false,
        error: { code: 'ALREADY_FINISHED', message: 'Player has already finished.' },
      };
    }

    // Head-to-head (2 players, any ruleset): the opponent wins immediately.
    if (state.players.length === 2) {
      const opponent = state.players.find((p) => p.id !== resigner.id);
      const recordedMove: RecordedAction = {
        sequence,
        playerId: resigner.id,
        action,
        timestamp,
        clockRemainingMs: meta.clockRemainingMs,
      };

      const nextState: GameState = {
        ...state,
        status: 'COMPLETED',
        winnerId: opponent?.id ?? null,
        endedAt: timestamp,
        lastMove: recordedMove,
        history: [...state.history, recordedMove],
      };

      return { success: true, state: nextState };
    }

    // Multiplayer: a forfeit earns the worst remaining place and the game
    // continues for the rest (completing automatically when one is left).
    const finish = applyFinish(state, actorIdx, 'FORFEIT', timestamp);

    const recordedMove: RecordedAction = {
      sequence,
      playerId: resigner.id,
      action,
      timestamp,
      clockRemainingMs: meta.clockRemainingMs,
    };

    const nextState: GameState = {
      ...state,
      players: finish.players,
      placements: finish.placements,
      currentPlayerIndex: finish.currentPlayerIndex,
      status: finish.status,
      winnerId: finish.winnerId,
      endedAt: finish.endedAt,
      lastMove: recordedMove,
      history: [...state.history, recordedMove],
    };

    return { success: true, state: nextState };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ACTION', message: 'Unknown action type.' },
  };
}
