import type { GameState } from '../types.js';
import type { AiTactical } from './types.js';
import { boardOf, packCell, packedSlotsBlockingStep, routeOf } from '../ai-structure.js';
import { getLegalMoves } from '../movement.js';
import { isGoalCell } from '../pathfinding.js';
import { RIVAL_PRESSURE_WINDOW } from './constants.js';

const packedScratch = new Int32Array(8);

export const NEUTRAL_TACTICAL: AiTactical = {
  pressure: 'NORMAL',
  intent: 'NONE',
  extraDepth: 0,
  restrict: false,
  winningCells: new Set(),
  blockingSlots: new Set(),
  escapeCells: new Set(),
  reason: 'nothing special',
};

export function readTacticalState(state: GameState, playerId: string): AiTactical {
  if (state.status !== 'IN_PROGRESS') return NEUTRAL_TACTICAL;
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return NEUTRAL_TACTICAL;

  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const escapeCells = new Set(own.firstSteps.map(packCell));

  // 1. Immediate win: take it, do not think about anything else.
  const winningCells = new Set<number>();
  for (const to of getLegalMoves(state, playerId)) {
    if (isGoalCell(to, me.goalDirection, state.mode)) winningCells.add(packCell(to));
  }
  if (winningCells.size > 0) {
    return {
      pressure: 'TACTICAL',
      intent: 'WIN',
      extraDepth: 1,
      restrict: true,
      winningCells,
      blockingSlots: new Set(),
      escapeCells,
      reason: 'immediate win available',
    };
  }

  // 2. A rival one step from their line.
  const blockingSlots = new Set<number>();
  let nearestName = '';
  let nearestDistance = Infinity;
  for (const opp of state.players) {
    if (opp.id === playerId || opp.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, opp);
    if (!route.hasGoalAccess || route.distance > 1) continue;
    if (route.distance < nearestDistance) {
      nearestDistance = route.distance;
      nearestName = opp.displayName;
    }
    const n = packedSlotsBlockingStep(opp.position.row, opp.position.col, packedScratch);
    for (let i = 0; i < n; i++) blockingSlots.add(packedScratch[i]);
  }
  if (blockingSlots.size > 0) {
    return {
      pressure: 'TACTICAL',
      intent: 'BLOCK',
      extraDepth: 2,
      restrict: true,
      winningCells,
      blockingSlots,
      escapeCells,
      reason: `${nearestName} is one step from the line`,
    };
  }

  // 3. Corridor pressure: the only way out of a dead end is forward.
  if (own.hasGoalAccess && own.tightest <= 1 && own.distance > 1) {
    const sealer = state.players.find(
      (p) => p.id !== playerId && p.status === 'ACTIVE' && p.wallsRemaining > 0
    );
    if (sealer) {
      return {
        pressure: 'TACTICAL',
        intent: 'ESCAPE',
        extraDepth: 1,
        restrict: true,
        winningCells,
        blockingSlots,
        escapeCells,
        reason: `route narrows to ${own.tightest} opening with ${sealer.displayName} still holding walls`,
      };
    }
  }

  // 4. Structural pressure.
  const chains = board.field.chains;
  const longestChain = chains.reduce((max, c) => Math.max(max, c.slots.length), 0);
  const forcedJump =
    own.firstSteps.length > 0 &&
    own.firstSteps.every(
      (s) => Math.abs(s.row - me.position.row) + Math.abs(s.col - me.position.col) > 1
    );
  const corridor =
    own.firstSteps.length <= 1 && (forcedJump || longestChain >= 2 || chains.length >= 2);
  const narrow = own.hasGoalAccess && own.tightest <= 2 && chains.length >= 1;
  const rivalCorridor =
    me.wallsRemaining > 0 &&
    state.players.some((p) => p.id !== playerId && routeOf(state, board, p).firstSteps.length <= 1);
  if (corridor || narrow || rivalCorridor) {
    const reason = corridor
      ? 'single-file route beside wall structure'
      : narrow
      ? `route narrows to ${own.tightest} opening`
      : 'a rival is running a single-file route';
    return {
      pressure: 'STRUCTURAL',
      intent: 'SHAPE',
      extraDepth: 1,
      restrict: false,
      winningCells,
      blockingSlots,
      escapeCells,
      reason,
    };
  }

  return { ...NEUTRAL_TACTICAL, escapeCells };
}

const PRESSURE_RADIUS = 3;

export function rivalPressureOnMe(state: GameState, playerId: string): number {
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return 0;
  let count = 0;
  let seen = 0;
  for (let i = state.history.length - 1; i >= 0 && seen < RIVAL_PRESSURE_WINDOW; i--) {
    const entry = state.history[i];
    if (entry.action.type !== 'PLACE_WALL') continue;
    seen++;
    const author = state.players.find((p) => p.id === entry.playerId);
    if (!author || author.id === playerId || author.status !== 'ACTIVE') continue;
    const w = entry.action.wall;
    const dRow = Math.min(
      Math.abs(w.row - me.position.row),
      Math.abs(w.row + 1 - me.position.row)
    );
    const dCol = Math.min(
      Math.abs(w.col - me.position.col),
      Math.abs(w.col + 1 - me.position.col)
    );
    if (dRow + dCol <= PRESSURE_RADIUS) count++;
  }
  return count;
}
