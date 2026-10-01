import type { CellCoord, GameAction, GameState, PlayerState, WallCoord } from '../types.js';
import type { AIProfile } from './types.js';
import {
  boardOf,
  openNeighbours,
  packCell,
  routeOf,
  type BoardStructure,
  type RouteProfile,
} from '../ai-structure.js';
import { isGoalCell } from '../pathfinding.js';
import { isLegalWallPlacement } from '../walls.js';
import {
  PLACEMENT_STEP,
  STRUCTURE_CAP_SHARE,
  WIN_SCORE,
} from './constants.js';

const fragileScratch = new Int32Array(8);

const FORK_CAP = 32;
export function logCount(value: number): number {
  return Math.log2(1 + Math.min(value, FORK_CAP));
}

const MOBILITY_MEMO = 2;
const mobilityMemoState: GameState[] = [null as unknown as GameState, null as unknown as GameState];
const mobilityMemoCounts: number[][] = [[], []];

export function resetMobilityMemo(): void {
  mobilityMemoState[0] = null as unknown as GameState;
  mobilityMemoState[1] = null as unknown as GameState;
  mobilityMemoCounts[0] = [];
  mobilityMemoCounts[1] = [];
}

const NEUTRAL_ROUTE: RouteProfile = {
  playerId: '',
  distance: 0,
  pathCount: 0,
  firstSteps: [],
  goalCells: 1,
  nearestGoals: 1,
  goalCellsNear: [],
  nearCells: [],
  region: 0,
  regionSize: 1,
  exitEdges: 0,
  openings: 4,
  tightest: 4,
  reach: 1,
  hasGoalAccess: false,
};

function placementOf(state: GameState, playerId: string): number | null {
  const p = state.placements.find((x) => x.playerId === playerId);
  return p ? p.place : null;
}

function mobilityOf(state: GameState, playerIndex: number): number {
  for (let slot = 0; slot < MOBILITY_MEMO; slot++) {
    if (mobilityMemoState[slot] === state) {
      const cached = mobilityMemoCounts[slot][playerIndex];
      if (cached !== undefined) return cached;
      const player = state.players[playerIndex];
      if (!player) return 0;
      const count = openNeighbours(boardOf(state).field.index, player.position.row, player.position.col, fragileScratch);
      mobilityMemoCounts[slot][playerIndex] = count;
      return count;
    }
  }
  const player = state.players[playerIndex];
  if (!player) return 0;
  const count = openNeighbours(boardOf(state).field.index, player.position.row, player.position.col, fragileScratch);
  mobilityMemoState[1] = mobilityMemoState[0];
  mobilityMemoCounts[1] = mobilityMemoCounts[0];
  mobilityMemoState[0] = state;
  mobilityMemoCounts[0] = [];
  mobilityMemoCounts[0][playerIndex] = count;
  return count;
}

function terminalScore(state: GameState, activePlayerId: string): number {
  const p = state.players.find((x) => x.id === activePlayerId);
  if (!p) return -WIN_SCORE;
  const place = p.place ?? placementOf(state, activePlayerId) ?? (state.winnerId === activePlayerId ? 1 : 2);
  if (place <= 1) return WIN_SCORE;
  return -WIN_SCORE + place * Math.floor(WIN_SCORE / (state.players.length + 1));
}

function tuningFor(
  mode: GameState['mode'],
  playerCount: number,
  weights: AIProfile['weights']
): { tightness: number; placement: number } {
  if (mode === 'race4') {
    return { tightness: weights.tightness * 0.5, placement: weights.placement * 1.5 };
  }
  if (playerCount > 2) {
    return { tightness: weights.tightness * 0.8, placement: weights.placement };
  }
  return { tightness: weights.tightness, placement: 0 };
}

export function evaluateState(state: GameState, activePlayerId: string, profile: AIProfile): number {
  if (state.status === 'COMPLETED') return terminalScore(state, activePlayerId);

  const me = state.players.find((p) => p.id === activePlayerId);
  if (!me) return 0;

  const board = boardOf(state);
  const own = routeOf(state, board, me);

  if (me.status === 'FINISHED') {
    const place = me.place ?? placementOf(state, activePlayerId) ?? 1;
    return WIN_SCORE - (place - 1) * PLACEMENT_STEP;
  }
  if (!own.hasGoalAccess) return -WIN_SCORE;
  if (own.distance === 0) return WIN_SCORE;

  const opponents = state.players.filter((p) => p.id !== activePlayerId);
  if (opponents.length === 0) return 0;
  const tuning = tuningFor(state.mode, state.players.length, profile.weights);
  const perStep = profile.weights.pathDifference;

  let minOpponentDist = Infinity;
  let threat: RouteProfile | null = null;
  let totalOpponentWalls = 0;
  let totalOpponentMobility = 0;
  let ahead = 0;
  let behind = 0;

  for (const opp of opponents) {
    const route = routeOf(state, board, opp);
    if (route.hasGoalAccess) {
      if (route.distance < minOpponentDist) {
        minOpponentDist = route.distance;
        threat = route;
      }
      if (route.distance < own.distance) ahead++;
      else if (route.distance > own.distance) behind++;
    }
    totalOpponentWalls += opp.wallsRemaining;
    totalOpponentMobility += mobilityOf(state, opp.index);
  }
  if (minOpponentDist === Infinity) minOpponentDist = own.distance;
  const rival = threat ?? { ...NEUTRAL_ROUTE, distance: own.distance };

  // 1. Absolute progress: marching pays whoever is ahead.
  const progress = -own.distance * perStep;

  // 2. Race lead — OUTCOME-AWARE:
  // A race is decided in PLIES: margin in plies is 2 * (rival - own) ± 1.
  // A decided race is worth its SIGN, not its magnitude.
  const iMoveFirst = state.players[state.currentPlayerIndex]?.id === activePlayerId ? 1 : -1;
  const leadSteps = minOpponentDist - own.distance;
  const plyMargin = 2 * leadSteps + iMoveFirst;
  const raceLive = Math.abs(plyMargin) <= 1;
  const lead = raceLive
    ? leadSteps * perStep
    : Math.sign(plyMargin) * perStep * 0.5;

  // 3. Structure: soft-capped below one step.
  const routeOptions = logCount(own.pathCount) + Math.log2(1 + own.firstSteps.length) * 0.5;
  const rivalOptions =
    logCount(rival.pathCount) + Math.log2(1 + rival.firstSteps.length) * 0.5;
  const rawStructure =
    (me.wallsRemaining - totalOpponentWalls / opponents.length) * profile.weights.wallAdvantage +
    (mobilityOf(state, me.index) - totalOpponentMobility / opponents.length) * profile.weights.mobility +
    (routeOptions - rivalOptions) * profile.weights.pathways +
    (own.tightest - rival.tightest) * tuning.tightness;
  const structureCap = perStep * STRUCTURE_CAP_SHARE;
  const structure = structureCap * Math.tanh(rawStructure / structureCap);

  // 4. Multiplayer placement pressure.
  const placementAdvantage = tuning.placement > 0 ? (ahead - behind) * tuning.placement : 0;

  return progress + lead + structure + placementAdvantage;
}

/**
 * Returns standard repetition penalty values:
 * 6 for immediate 1-ply reversal, 3 for 2-ply revisit, 1 for older revisits.
 */
export function repetitionPenalty(
  state: GameState,
  playerId: string,
  to: CellCoord
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  if (isGoalCell(to, player.goalDirection, state.mode)) return 0;

  const recent: CellCoord[] = [];
  for (let i = state.history.length - 1; i >= 0 && recent.length < 6; i--) {
    const h = state.history[i];
    if (h.playerId === playerId && h.action.type === 'MOVE') {
      recent.push(h.action.to);
    }
  }
  for (let k = 1; k < recent.length; k++) {
    const t = recent[k];
    if (t.row === to.row && t.col === to.col) {
      if (k === 1) return 6;
      if (k === 2) return 3;
      return 1;
    }
  }
  return 0;
}

export function shortestPathStep(state: GameState, playerId: string): CellCoord | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const board = boardOf(state);
  const route = routeOf(state, board, player);
  if (!route.hasGoalAccess) return null;
  return route.firstSteps[0] ?? null;
}

/**
 * Detects whether jumping over a rival is an immediate suicidal trap.
 * When jumping past a rival who holds walls into an adjacent square,
 * if the rival can legally wall our forward exit without blocking themselves,
 * this jump forfeits tempo and traps the pawn behind walls.
 */
export function jumpTrapPenalty(
  state: GameState,
  board: BoardStructure,
  mover: PlayerState,
  action: GameAction
): number {
  if (action.type !== 'MOVE') return 0;
  const from = mover.position;
  const to = action.to;
  const isJump = Math.abs(to.row - from.row) === 2 || Math.abs(to.col - from.col) === 2;
  if (!isJump) return 0;

  const route = routeOf(state, board, mover);
  if (route.distance <= 2) return 0;

  const jumpedRow = Math.floor((from.row + to.row) / 2);
  const jumpedCol = Math.floor((from.col + to.col) / 2);
  const rival = state.players.find(
    (p) =>
      p.id !== mover.id &&
      p.status === 'ACTIVE' &&
      p.position.row === jumpedRow &&
      p.position.col === jumpedCol
  );
  if (!rival || rival.wallsRemaining < 2) return 0;

  const slots: WallCoord[] = [];
  if (mover.goalDirection === 'BOTTOM' && to.row < 8) {
    if (to.col > 0) slots.push({ row: to.row, col: to.col - 1, orientation: 'H' });
    if (to.col < 8) slots.push({ row: to.row, col: to.col, orientation: 'H' });
  } else if (mover.goalDirection === 'TOP' && to.row > 0) {
    if (to.col > 0) slots.push({ row: to.row - 1, col: to.col - 1, orientation: 'H' });
    if (to.col < 8) slots.push({ row: to.row - 1, col: to.col, orientation: 'H' });
  } else if (mover.goalDirection === 'RIGHT' && to.col < 8) {
    if (to.row > 0) slots.push({ row: to.row - 1, col: to.col, orientation: 'V' });
    if (to.row < 8) slots.push({ row: to.row, col: to.col, orientation: 'V' });
  } else if (mover.goalDirection === 'LEFT' && to.col > 0) {
    if (to.row > 0) slots.push({ row: to.row - 1, col: to.col - 1, orientation: 'V' });
    if (to.row < 8) slots.push({ row: to.row, col: to.col - 1, orientation: 'V' });
  }

  for (const slot of slots) {
    if (isLegalWallPlacement(state, rival.id, slot)) {
      return 2.5; // step units
    }
  }
  return 0;
}

export function isFragileLanding(
  board: BoardStructure,
  state: GameState,
  playerId: string,
  goal: PlayerState['goalDirection'],
  to: CellCoord
): boolean {
  const n = openNeighbours(board.field.index, to.row, to.col, fragileScratch);
  if (n <= 1) return true;
  return false;
}
