/**
 * Strategic threat layer: fast, bounded detection of rival blocking walls.
 * Replaces the legacy 1,185-line combinatorial expert system.
 */
import {
  boardOf,
  packSlot,
  routeOf,
  unpackSlot,
} from './ai-structure.js';
import type { GameAction, GameState, PlayerState, WallCoord } from './types.js';
import { applyAction } from './ruleset.js';
import { isLegalWallPlacement } from './walls.js';
import { getShortestDistance, getShortestPath } from './pathfinding.js';

export interface ThreatWall {
  packed: number;
  delay: number;
  extendsChain: boolean;
  pairDelay: number;
  convergesWith: number[];
  theirCost: number;
}

export interface ThreatProfile {
  rivalId: string;
  rivalIndex: number;
  wallsLeft: number;
  walls: ThreatWall[];
  bite: number;
  structural: boolean;
  targetsUs: boolean;
  live: boolean;
  score: number;
  reason: string;
}

export interface StrategicRead {
  threats: ThreatProfile[];
  primary: ThreatProfile | null;
  counters: number[];
  multiThreat: boolean;
  urgent: boolean;
  raceDecided: boolean;
}

export interface AttackBlueprint {
  victimId: string;
  slots: number[];
  combinedDamage: number;
  damage: number;
  memberDamage: number[];
  efficiency: number;
  freeStepsAfter: number;
  relevance: number;
}

export interface SealForecast {
  damage: number;
  slots: number[];
  laneCrossings: number[];
  escapes: number[];
}

export interface ExchangeOutcome {
  theirBestDelay: number;
  myNewDistance: number;
  myDistance: number;
  theirDistance: number;
  brokenPlan: boolean;
  damagePrevented: number;
  reply: GameAction | null;
}

const EMPTY_READ: StrategicRead = {
  threats: [],
  primary: null,
  counters: [],
  multiThreat: false,
  urgent: false,
  raceDecided: false,
};

export function resetStrategicMemo(): void {}
export function resetAttackMemo(): void {}
export function resetFragilityMemo(): void {}

function findPathBlockingWallsForThreat(
  st: GameState,
  actorId: string,
  target: PlayerState
): { wall: WallCoord; delay: number }[] {
  const base = getShortestDistance(target.position, target.goalDirection, st.walls, st.mode);
  if (!Number.isFinite(base) || base <= 0) return [];
  const path = getShortestPath(target.position, target.goalDirection, st.walls, st.mode);
  if (!path || path.length === 0) return [];

  const candidates: WallCoord[] = [];
  const seen = new Set<string>();
  const add = (w: WallCoord) => {
    if (w.row < 0 || w.row > 7 || w.col < 0 || w.col > 7) return;
    const k = `${w.row},${w.col},${w.orientation}`;
    if (!seen.has(k)) {
      seen.add(k);
      candidates.push(w);
    }
  };

  const { row, col } = target.position;
  add({ row: row - 1, col, orientation: 'H' });
  add({ row, col, orientation: 'H' });
  add({ row, col: col - 1, orientation: 'V' });
  add({ row, col, orientation: 'V' });

  for (let step = 0; step < Math.min(3, path.length); step++) {
    const next = path[step];
    if (next.row !== row) {
      const r = Math.min(row, next.row);
      add({ row: r, col: Math.max(0, col - 1), orientation: 'H' });
      add({ row: r, col, orientation: 'H' });
    } else if (next.col !== col) {
      const c = Math.min(col, next.col);
      add({ row: Math.max(0, row - 1), col: c, orientation: 'V' });
      add({ row, col: c, orientation: 'V' });
    }
  }

  const results: { wall: WallCoord; delay: number }[] = [];
  for (const slot of candidates) {
    if (!isLegalWallPlacement(st, actorId, slot)) continue;
    const after = getShortestDistance(target.position, target.goalDirection, [...st.walls, slot], st.mode);
    if (Number.isFinite(after) && after > base) {
      results.push({ wall: slot, delay: after - base });
    }
  }
  results.sort((a, b) => b.delay - a.delay);
  return results;
}

export function readStrategicState(
  state: GameState,
  playerId: string,
  nearRivalDistance: number
): StrategicRead {
  const me = state.players.find((p) => p.id === playerId);
  if (state.status !== 'IN_PROGRESS' || !me || me.wallsRemaining <= 0) {
    return EMPTY_READ;
  }
  const board = boardOf(state);
  const myRoute = routeOf(state, board, me);
  if (!myRoute.hasGoalAccess) {
    return { ...EMPTY_READ, raceDecided: true };
  }

  const lead = Number.isFinite(nearRivalDistance) ? nearRivalDistance - myRoute.distance : Infinity;
  const threats: ThreatProfile[] = [];

  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE' || rival.wallsRemaining <= 0) continue;
    const r = routeOf(state, board, rival);
    if (!r.hasGoalAccess) continue;

    const blocks = findPathBlockingWallsForThreat(state, rival.id, me);
    if (blocks.length === 0) continue;

    const threatWalls: ThreatWall[] = blocks.slice(0, 3).map((b) => ({
      packed: packSlot(b.wall),
      delay: b.delay,
      extendsChain: false,
      pairDelay: 0,
      convergesWith: [],
      theirCost: 0,
    }));

    threats.push({
      rivalId: rival.id,
      rivalIndex: rival.index,
      wallsLeft: rival.wallsRemaining,
      walls: threatWalls,
      bite: threatWalls[0].delay,
      structural: false,
      targetsUs: threatWalls[0].delay > 0,
      live: r.distance <= 4,
      score: threatWalls[0].delay,
      reason: `${rival.displayName}: delay ${threatWalls[0].delay}`,
    });
  }

  threats.sort((a, b) => b.score - a.score);
  const primary = threats[0] ?? null;
  const urgent = primary !== null && primary.bite >= 2 && Math.abs(lead) <= primary.bite + 1;
  const counters: number[] = primary ? primary.walls.map((w) => w.packed) : [];

  return {
    threats,
    primary,
    counters,
    multiThreat: threats.length >= 2,
    urgent,
    raceDecided: lead > 6,
  };
}

export function planSurvives(
  before: StrategicRead | null,
  me: PlayerState,
  after: GameState
): number {
  if (!before || !before.primary || before.primary.walls.length === 0) return 0;
  const slot = unpackSlot(before.primary.walls[0].packed);
  return isLegalWallPlacement(after, me.id, slot) ? 1 : 0;
}

export function planSuppression(
  strategic: StrategicRead | null,
  me: PlayerState,
  afterState: GameState
): number {
  if (!strategic || !strategic.primary || strategic.primary.walls.length === 0) return 0;
  const un = unpackSlot(strategic.primary.walls[0].packed);
  return isLegalWallPlacement(afterState, me.id, un) ? 0 : strategic.primary.bite;
}

export function readAttackBlueprint(state: GameState, me: PlayerState): AttackBlueprint | null {
  return null;
}

export function forecastSeal(
  state: GameState,
  me: PlayerState,
  ownDistance: number,
  strategic: StrategicRead | null,
  rivalPressure: number
): SealForecast | null {
  return null;
}

export function planDamageAfter(
  ..._args: any[]
): number {
  return 0;
}

export function maxIncomingDamage(state: GameState, me: PlayerState): number {
  return 0;
}

export function fragilityDelta(state: GameState, me: PlayerState, action: GameAction): number {
  return 0;
}

export function exchangeOutcome(
  state: GameState,
  me: PlayerState,
  action: GameAction,
  strategic: StrategicRead | null
): ExchangeOutcome {
  const applied = applyAction(state, action);
  if (!applied.success) {
    return {
      theirBestDelay: 0,
      myNewDistance: Infinity,
      myDistance: Infinity,
      theirDistance: Infinity,
      brokenPlan: false,
      damagePrevented: 0,
      reply: null,
    };
  }
  const myAfter = applied.state.players.find((p) => p.id === me.id);
  const myDist = myAfter
    ? getShortestDistance(myAfter.position, myAfter.goalDirection, applied.state.walls, state.mode)
    : Infinity;
  let brokenPlan = false;
  if (strategic && strategic.primary && strategic.primary.walls.length > 0) {
    const un = unpackSlot(strategic.primary.walls[0].packed);
    if (!isLegalWallPlacement(applied.state, me.id, un)) {
      brokenPlan = true;
    }
  }
  return {
    theirBestDelay: 0,
    myNewDistance: myDist,
    myDistance: myDist,
    theirDistance: myDist,
    brokenPlan,
    damagePrevented: brokenPlan ? (strategic?.primary?.bite ?? 0) : 0,
    reply: null,
  };
}
