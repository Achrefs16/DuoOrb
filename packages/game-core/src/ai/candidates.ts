import type { CellCoord, GameAction, GameState, WallCoord } from '../types.js';
import type { AIProfile, AiTactical, ScoredCandidate, WallInsight } from './types.js';
import {
  boardOf,
  cellToIndex,
  packCell,
  packSlot,
  packedSlotsBlockingStep,
  packedSlotsTouchingCell,
  projectedGoalField,
  routeOf,
  slotConflicts,
  slotKey,
  unpackSlot,
  type BoardStructure,
  type RouteProfile,
} from '../ai-structure.js';
import { planSuppression, type AttackBlueprint, type SealForecast, type StrategicRead } from '../ai-threat.js';
import { applyAction } from '../ruleset.js';
import { getLegalMoves } from '../movement.js';
import { isLegalWallPlacement } from '../walls.js';
import {
  ATTACK_CREDIT_CAP,
  ATTACK_SHARE,
  APPROACH_CELLS,
  CHAIN_EXTENSION_CELLS,
  CONTEST_DISTANCE,
  INNER_PLAN_WALLS,
  PLAN_PROMOTION,
  PROBE_PER_WALL,
  RAW_SLOT_CAP,
  ROUTE_BAND_CELLS,
  SELF_CRITICAL_TIGHTEST,
  SLOT_PREVENT_CAP,
} from './constants.js';

const APPROACH_RANGE = 4;
const SLOT_THREAT = 1;
const SLOT_ROUTE = 2;
const SLOT_APPROACH = 8;
const SLOT_CHAIN = 16;
const SLOT_SELF_ROUTE = 32;
const SLOT_CONTESTED = 64;
const SLOT_RIVAL_PLAN = 128;
const SLOT_PREVENT = 256;
const SLOT_SELF_EXIT = 512;
const SLOT_MY_PLAN = 1024;
const SLOT_SEALBREAK = 2048;

function slotPriority(reason: number): number {
  let score = 0;
  if (reason & SLOT_SELF_EXIT) score += 9;
  if (reason & SLOT_SEALBREAK) score += 12;
  if (reason & SLOT_MY_PLAN) score += 12;
  if (reason & SLOT_RIVAL_PLAN) score += 12;
  if (reason & SLOT_PREVENT) score += 8;
  if (reason & SLOT_THREAT) score += 6;
  if (reason & SLOT_APPROACH) score += 3;
  if (reason & SLOT_ROUTE) score += 2;
  if (reason & SLOT_CHAIN) score += 2;
  if (reason & SLOT_CONTESTED) score += 1;
  if (reason & SLOT_SELF_ROUTE) score += 1;
  return score;
}

export function moveOrder(to: CellCoord): number {
  return packCell(to);
}

export function wallOrder(slot: WallCoord): number {
  return 128 + packSlot(slot);
}

export function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.onPath !== b.onPath) return a.onPath ? -1 : 1;
  if (a.rank !== b.rank) return b.rank - a.rank;
  return a.order - b.order;
}

interface WallSlotIdea {
  packed: number;
  reason: number;
  priority: number;
}

const packedScratch = new Int32Array(8);

function packedName(packed: number): string {
  const row = Math.floor(packed / 16);
  const col = Math.floor(packed / 2) % 8;
  return `${row},${col},${packed % 2 === 1 ? 'V' : 'H'}`;
}

function slotConflictsPacked(index: Uint8Array, packed: number): boolean {
  return slotConflicts(index, unpackSlot(packed));
}

class SlotPool {
  private readonly keys = new Int32Array(RAW_SLOT_CAP * 2).fill(-1);
  private readonly reasons = new Int32Array(RAW_SLOT_CAP * 2);
  private readonly priorities = new Int32Array(RAW_SLOT_CAP * 2);
  private count = 0;

  clear(): void {
    this.keys.fill(-1);
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  full(): boolean {
    return this.count >= RAW_SLOT_CAP;
  }

  reasonAt(packed: number): number {
    const slot = this.find(packed);
    return slot < 0 ? 0 : this.reasons[slot * 2];
  }

  add(packed: number, reason: number): void {
    const existing = this.find(packed);
    if (existing >= 0) {
      this.reasons[existing * 2] |= reason;
      this.priorities[existing * 2] = slotPriority(this.reasons[existing * 2]);
      return;
    }
    if (this.count >= RAW_SLOT_CAP) return;
    const slot = this.count * 2;
    this.keys[slot] = packed;
    this.reasons[slot] = reason;
    this.priorities[slot] = slotPriority(reason);
    this.count++;
  }

  drain(out: WallSlotIdea[]): WallSlotIdea[] {
    for (let i = 0; i < this.count; i++) {
      out.push({ packed: this.keys[i * 2], reason: this.reasons[i * 2], priority: this.priorities[i * 2] });
    }
    out.sort((a, b) => (a.priority !== b.priority ? b.priority - a.priority : a.packed - b.packed));
    return out;
  }

  private find(packed: number): number {
    for (let i = 0; i < this.count; i++) {
      if (this.keys[i * 2] === packed) return i;
    }
    return -1;
  }
}

const poolScratch = new SlotPool();

class CellTally {
  private readonly keys = new Int32Array(256).fill(-1);
  private readonly counts = new Int32Array(256);
  private count = 0;

  clear(): void {
    this.keys.fill(-1);
    this.count = 0;
  }

  bump(packed: number): void {
    const mask = this.keys.length - 1;
    let slot = packed & mask;
    for (let probe = 0; probe < this.keys.length; probe++) {
      const key = this.keys[slot];
      if (key === packed) {
        this.counts[slot]++;
        return;
      }
      if (key === -1) {
        this.keys[slot] = packed;
        this.counts[slot] = 1;
        this.count++;
        return;
      }
      slot = (slot + 1) & mask;
    }
  }

  atLeast(packed: number, needed: number): boolean {
    const mask = this.keys.length - 1;
    let slot = packed & mask;
    for (let probe = 0; probe < this.keys.length; probe++) {
      const key = this.keys[slot];
      if (key === packed) return this.counts[slot] >= needed;
      if (key === -1) return false;
      slot = (slot + 1) & mask;
    }
    return false;
  }
}

const contestedScratch = new CellTally();

class RouteCellSet {
  private readonly cells = new Int32Array(128);
  private count = 0;

  clear(): void {
    this.count = 0;
  }

  get size(): number {
    return this.count;
  }

  add(nearCells: CellCoord[]): void {
    for (const cell of nearCells) {
      if (this.count >= this.cells.length) return;
      this.cells[this.count++] = packCell(cell);
    }
  }

  nearPacked(slot: number, radius: number): boolean {
    const row = Math.floor(slot / 16);
    const col = Math.floor(slot / 2) % 8;
    for (let i = 0; i < this.count; i++) {
      const cell = this.cells[i];
      if (Math.abs(Math.floor(cell / 9) - row) <= radius && Math.abs((cell % 9) - col) <= radius) {
        return true;
      }
    }
    return false;
  }
}

const rivalScratch = new RouteCellSet();

export function collectWallSlotIdeas(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  strategic: StrategicRead | null,
  attack: AttackBlueprint | null = null,
  seal: SealForecast | null = null
): WallSlotIdea[] {
  const index = board.field.index;
  const pool = poolScratch;
  pool.clear();
  const scratch = packedScratch;
  const addPacked = (packed: number, reason: number) => {
    if (pool.full()) return;
    if (pool.reasonAt(packed) === 0 && slotConflictsPacked(index, packed)) return;
    pool.add(packed, reason);
  };

  const contestedCells = contestedScratch;
  contestedCells.clear();
  for (const player of state.players) {
    for (const cell of routeOf(state, board, player).nearCells) {
      contestedCells.bump(packCell(cell));
    }
  }

  for (const rival of state.players) {
    if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
    const route = routeOf(state, board, rival);
    if (!route.hasGoalAccess) continue;

    // 1. Immediate threat.
    if (route.distance <= 1) {
      const n = packedSlotsBlockingStep(rival.position.row, rival.position.col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_THREAT);
    }

    // 2. Goal approaches
    if (route.distance <= APPROACH_RANGE) {
      const goals = route.goalCellsNear;
      for (let g = 0; g < goals.length && g < APPROACH_CELLS; g++) {
        const n = packedSlotsTouchingCell(goals[g].row, goals[g].col, scratch);
        for (let i = 0; i < n; i++) addPacked(scratch[i], SLOT_APPROACH);
      }
    }

    // 3. The route itself (entire path to cover full-board detours and funnels)
    const cells = route.nearCells;
    for (let c = 0; c < cells.length; c++) {
      const reason =
        contestedCells.atLeast(packCell(cells[c]), 2)
          ? SLOT_ROUTE | SLOT_CONTESTED
          : SLOT_ROUTE;
      const n = packedSlotsTouchingCell(cells[c].row, cells[c].col, scratch);
      for (let i = 0; i < n; i++) addPacked(scratch[i], reason);
    }
  }

  // 4. Chain extensions that build structures or funnels.
  for (const ext of board.field.extensions) {
    addPacked(packSlot(ext), SLOT_CHAIN);
  }

  // 5. This player's own route.
  const ownCells = own.nearCells;
  const squeezed = own.hasGoalAccess && own.tightest <= SELF_CRITICAL_TIGHTEST;
  const selfBand = squeezed ? ROUTE_BAND_CELLS : APPROACH_CELLS + 1;
  for (let c = 0; c < ownCells.length && c < selfBand; c++) {
    const n = packedSlotsTouchingCell(ownCells[c].row, ownCells[c].col, scratch);
    for (let i = 0; i < n; i++) {
      addPacked(scratch[i], squeezed ? SLOT_SELF_EXIT | SLOT_SELF_ROUTE : SLOT_SELF_ROUTE);
    }
  }

  // 6. The strategic layer's slots.
  if (strategic && strategic.urgent && !strategic.raceDecided && strategic.primary) {    const primary = strategic.primary;
    for (let i = 0; i < primary.walls.length; i++) {
      addPacked(primary.walls[i].packed, SLOT_RIVAL_PLAN);
    }
    let plugs = 0;
    for (const wall of primary.walls) {
      if (plugs >= SLOT_PREVENT_CAP) break;
      const slot = unpackSlot(wall.packed);
      const n = packedSlotsTouchingCell(
        Math.min(8, Math.max(0, slot.row)),
        Math.min(8, Math.max(0, slot.col)),
        scratch
      );
      for (let i = 0; i < n && plugs < SLOT_PREVENT_CAP; i++) {
        if (scratch[i] === wall.packed) continue;
        if ((pool.reasonAt(scratch[i]) & SLOT_RIVAL_PLAN) !== 0) continue;
        addPacked(scratch[i], SLOT_PREVENT);
        plugs++;
      }
    }
  }
  const ideas: WallSlotIdea[] = [];
  return pool.drain(ideas);
}

export function moveCandidates(state: GameState, playerId: string, own: RouteProfile): ScoredCandidate[] {
  const onPath = new Set(own.firstSteps.map(packCell));
  const out: ScoredCandidate[] = [];
  for (const to of getLegalMoves(state, playerId)) {
    out.push({
      action: { type: 'MOVE', to },
      onPath: onPath.has(packCell(to)),
      wall: null,
      rank: 0,
      order: moveOrder(to),
    });
  }
  return out;
}

export function buildRootCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile,
  tactical: AiTactical,
  deadline: number,
  strategic: StrategicRead | null = null,
  attack: AttackBlueprint | null = null,
  seal: SealForecast | null = null
): ScoredCandidate[] {
  const me = state.players.find((p) => p.id === playerId);
  if (!me || me.wallsRemaining <= 0 || profile.maxCandidateWalls <= 0) {
    return moveCandidates(state, playerId, own);
  }

  const rivals = state.players.filter(
    (p) => p.id !== playerId && p.status === 'ACTIVE' && routeOf(state, board, p).hasGoalAccess
  );
  if (rivals.length === 0) return moveCandidates(state, playerId, own);

  const rivalsDisarmed = rivals.every((r) => r.wallsRemaining <= 0);
  const ideas = collectWallSlotIdeas(state, board, own, playerId, strategic, attack, seal);
  const probeCap = Math.min(ideas.length, profile.maxCandidateWalls * PROBE_PER_WALL);
  const perStep = profile.weights.pathDifference;
  const focus = 1 - profile.randomness;
  const walls: ScoredCandidate[] = [];
  const wallNextStates = new Map<number, GameState>();

  for (let i = 0; i < probeCap; i++) {
    if (Date.now() > deadline) break;
    const slot = unpackSlot(ideas[i].packed);
    if (!isLegalWallPlacement(state, playerId, slot)) continue;
    const applied = applyAction(state, { type: 'PLACE_WALL', wall: slot });
    if (!applied.success) continue;
    const next = applied.state;
    const nextBoard = boardOf(next);

    let before = Infinity;
    let after = Infinity;
    let rivalBefore: RouteProfile | null = null;
    let rivalAfter: RouteProfile | null = null;
    for (const rival of rivals) {
      const b = routeOf(state, board, rival);
      const a = routeOf(next, nextBoard, rival);
      if (b.distance < before) {
        before = b.distance;
        rivalBefore = b;
      }
      if (a.distance < after) {
        after = a.distance;
        rivalAfter = a;
      }
    }

    const delay = before === Infinity ? 0 : Math.max(0, after - before);
    if (rivalsDisarmed && delay <= 0) continue;
    const ownAfter = routeOf(next, nextBoard, me);
    const selfCost =
      own.hasGoalAccess && ownAfter.hasGoalAccess
        ? Math.max(0, ownAfter.distance - own.distance)
        : 0;
    const narrowAdv =
      rivalBefore && rivalAfter ? Math.max(0, rivalBefore.tightest - rivalAfter.tightest) : 0;
    const forkDeny =
      rivalBefore && rivalAfter
        ? Math.max(0, Math.log2(rivalBefore.pathCount + 1) - Math.log2(rivalAfter.pathCount + 1))
        : 0;

    const key = slotKey(slot);
    const touches = board.field.chainTouch.get(key) ?? 0;
    const extendsChain = touches > 0;
    const bridgesChains = touches >= 2;
    const turnsChain = board.field.turnExtensions.has(key);
    const shapesSelf = (ideas[i].reason & SLOT_SELF_ROUTE) !== 0;
    const contested = (ideas[i].reason & SLOT_CONTESTED) !== 0;

    const structure =
      (narrowAdv * perStep * 0.5 +
        forkDeny * perStep * 0.4 +
        (extendsChain ? perStep * 0.4 : 0) +
        (turnsChain ? perStep * 0.3 : 0) +
        (bridgesChains ? perStep * 0.5 : 0) +
        (shapesSelf ? perStep * 0.3 : 0) +
        (contested ? perStep * 0.25 : 0)) *
      focus;

    walls.push({
      action: { type: 'PLACE_WALL', wall: slot },
      onPath: false,
      wall: { slot, delay, selfCost, narrowAdv, forkDeny, extendsChain, turnsChain, bridgesChains, shapesSelf, contested, structure, planSuppression: 0 },
      rank: delay * perStep + structure - selfCost * perStep,
      order: wallOrder(slot),
      planSlot: (ideas[i].reason & SLOT_RIVAL_PLAN) !== 0,
      attackSlot: false,
      sealbreak: false,
    });
    wallNextStates.set(wallOrder(slot), next);
  }

  walls.sort(compareCandidates);

  // Maximum denial guarantee: Never squeeze out maximum-denial walls!
  let maxDenial = 0;
  for (const w of walls) {
    if (w.wall && w.wall.delay > maxDenial) maxDenial = w.wall.delay;
  }
  const maxDenialKept = maxDenial > 0 ? walls.filter((c) => c.wall && c.wall.delay === maxDenial).slice(0, 2) : [];
  const keptOrders = new Set(maxDenialKept.map((c) => c.order));

  // Plan slots kept before rank
  const planKept = walls.filter((c) => c.planSlot && !keptOrders.has(c.order)).slice(0, profile.maxCandidateWalls);
  for (const c of planKept) keptOrders.add(c.order);

  const remainingQuota = Math.max(0, profile.maxCandidateWalls - keptOrders.size);
  const restKept = walls.filter((c) => !keptOrders.has(c.order)).slice(0, remainingQuota);
  const kept = maxDenialKept.concat(planKept).concat(restKept).sort(compareCandidates);

  if (strategic && strategic.urgent && !strategic.raceDecided && me.wallsRemaining > 0) {
    for (const candidate of kept) {
      if (!candidate.wall) continue;
      const next = wallNextStates.get(candidate.order);
      if (!next) continue;
      candidate.wall.planSuppression = planSuppression(strategic, me, next);
      if (candidate.wall.planSuppression > 0) {
        candidate.onPath = false;
        candidate.rank += candidate.wall.planSuppression * perStep * PLAN_PROMOTION;
      }
    }
    kept.sort(compareCandidates);
  }

  const moves = moveCandidates(state, playerId, own);
  let all = moves.concat(kept);
  all.sort(compareCandidates);

  if (tactical.restrict) {
    let filtered: ScoredCandidate[] = [];
    if (tactical.intent === 'WIN') {
      filtered = all.filter(
        (c) => c.action.type === 'MOVE' && tactical.winningCells.has(packCell(c.action.to))
      );
    } else if (tactical.intent === 'BLOCK') {
      filtered = all.filter(
        (c) =>
          c.action.type === 'PLACE_WALL' &&
          c.wall !== null &&
          tactical.blockingSlots.has(packSlot(c.action.wall)) &&
          c.wall.delay > 0
      );
      if (filtered.length === 0) {
        return moveCandidates(state, playerId, own).sort(compareCandidates);
      }
    } else if (tactical.intent === 'ESCAPE') {
      filtered = all.filter(
        (c) => c.action.type === 'MOVE' && tactical.escapeCells.has(packCell(c.action.to))
      );
    }
    if (filtered.length > 0) {
      all = filtered;
    }
  }

  return all;
}

export function innerPlanWalls(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  moverId: string,
  rootId: string,
  sealSlots: number[] | null,
  depth: number
): ScoredCandidate[] {
  const mover = state.players[state.currentPlayerIndex];
  if (!mover || mover.wallsRemaining <= 0) return [];
  if (depth <= 1) return [];

  let anchorRow = -1;
  let anchorCol = -1;
  const root = moverId !== rootId ? state.players.find((p) => p.id === rootId) : null;
  let nearRoot = false;
  if (root && root.status === 'ACTIVE') {
    anchorRow = root.position.row;
    anchorCol = root.position.col;
    nearRoot = Math.abs(mover.position.row - anchorRow) <= 3 && Math.abs(mover.position.col - anchorCol) <= 3;
  }

  const nearOwn = (s: { row: number; col: number }): boolean => {
    for (const cell of own.nearCells) {
      if (Math.abs(s.row - cell.row) <= 2 && Math.abs(s.col - cell.col) <= 2) return true;
    }
    return false;
  };

  const volatile =
    own.hasGoalAccess &&
    (own.tightest <= 2 ||
      nearRoot ||
      board.field.chains.some((c) =>
        c.slots.some((s) => {
          if (nearOwn(s)) return true;
          if (anchorRow >= 0 && Math.abs(s.row - anchorRow) <= 2 && Math.abs(s.col - anchorCol) <= 2) {
            return true;
          }
          return false;
        })
      ) ||
      state.players.some(
        (p) => p.id !== moverId && p.status === 'ACTIVE' && routeOf(state, board, p).distance <= 1
      ));
  if (!volatile) return [];

  const out: ScoredCandidate[] = [];
  if (anchorRow >= 0 && sealSlots) {
    for (const packed of sealSlots) {
      if (out.length >= INNER_PLAN_WALLS) break;
      const slot = unpackSlot(packed);
      if (slotConflicts(board.field.index, slot)) continue;
      out.push({
        action: { type: 'PLACE_WALL', wall: slot },
        onPath: false,
        wall: null,
        rank: 0,
        order: wallOrder(slot),
      });
    }
  }

  // Tactical cutoff walls directly blocking root's advance towards goal
  if (nearRoot && anchorRow >= 0 && root && out.length < INNER_PLAN_WALLS) {
    const directSlots: WallCoord[] = [];
    if (root.goalDirection === 'BOTTOM') {
      directSlots.push({ row: anchorRow, col: anchorCol, orientation: 'H' });
      directSlots.push({ row: anchorRow, col: anchorCol - 1, orientation: 'H' });
    } else if (root.goalDirection === 'TOP') {
      directSlots.push({ row: anchorRow - 1, col: anchorCol, orientation: 'H' });
      directSlots.push({ row: anchorRow - 1, col: anchorCol - 1, orientation: 'H' });
    } else if (root.goalDirection === 'RIGHT') {
      directSlots.push({ row: anchorRow, col: anchorCol, orientation: 'V' });
      directSlots.push({ row: anchorRow - 1, col: anchorCol, orientation: 'V' });
    } else if (root.goalDirection === 'LEFT') {
      directSlots.push({ row: anchorRow, col: anchorCol - 1, orientation: 'V' });
      directSlots.push({ row: anchorRow - 1, col: anchorCol - 1, orientation: 'V' });
    }
    for (const slot of directSlots) {
      if (out.length >= INNER_PLAN_WALLS) break;
      if (slot.row < 0 || slot.row >= 8 || slot.col < 0 || slot.col >= 8) continue;
      if (slotConflicts(board.field.index, slot)) continue;
      out.push({
        action: { type: 'PLACE_WALL', wall: slot },
        onPath: false,
        wall: null,
        rank: 0,
        order: wallOrder(slot),
      });
    }
  }

  for (const slot of board.field.extensions) {
    if (out.length >= INNER_PLAN_WALLS) break;
    const near =
      anchorRow >= 0
        ? Math.abs(slot.row - anchorRow) <= 2 && Math.abs(slot.col - anchorCol) <= 2
        : nearOwn(slot);
    if (!near || slotConflicts(board.field.index, slot)) continue;
    out.push({
      action: { type: 'PLACE_WALL', wall: slot },
      onPath: false,
      wall: null,
      rank: 0,
      order: wallOrder(slot),
    });
  }

  return out;
}

export function buildSearchCandidates(
  state: GameState,
  board: BoardStructure,
  own: RouteProfile,
  playerId: string,
  profile: AIProfile,
  depth: number,
  rootId: string,
  sealSlots: number[] | null
): ScoredCandidate[] {
  const moves = moveCandidates(state, playerId, own);
  moves.sort(compareCandidates);
  if (profile.maxCandidateWalls <= 0) return moves;
  const walls = innerPlanWalls(state, board, own, playerId, rootId, sealSlots, depth);
  if (walls.length === 0) return moves;
  return moves.concat(walls).sort(compareCandidates);
}

export function orderCandidates(
  candidates: ScoredCandidate[],
  ttMove: GameAction | null | undefined,
  killers: (GameAction | null)[]
): ScoredCandidate[] {
  if (candidates.length <= 1) return candidates;
  if (!ttMove && killers.length === 0) return candidates;

  const same = (a: GameAction, b: GameAction): boolean => {
    if (a.type !== b.type) return false;
    if (a.type === 'MOVE' && b.type === 'MOVE') return a.to.row === b.to.row && a.to.col === b.to.col;
    if (a.type === 'PLACE_WALL' && b.type === 'PLACE_WALL') {
      return a.wall.row === b.wall.row && a.wall.col === b.wall.col && a.wall.orientation === b.wall.orientation;
    }
    return false;
  };

  const out: ScoredCandidate[] = [];
  const used = new Set<number>();

  if (ttMove) {
    const idx = candidates.findIndex((c) => same(c.action, ttMove));
    if (idx >= 0) {
      out.push(candidates[idx]);
      used.add(idx);
    }
  }

  for (const killer of killers) {
    if (!killer) continue;
    const idx = candidates.findIndex((c, i) => !used.has(i) && same(c.action, killer));
    if (idx >= 0) {
      out.push(candidates[idx]);
      used.add(idx);
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    if (!used.has(i)) out.push(candidates[i]);
  }

  return out;
}

export function getCandidateActions(
  state: GameState,
  playerId: string,
  maxWalls: number
): GameAction[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const board = boardOf(state);
  const own = routeOf(state, board, player);
  const profile: AIProfile = {
    difficulty: 'normal',
    depth: 2,
    randomness: 0,
    weights: { pathDifference: 10, wallAdvantage: 1, mobility: 0.5, pathways: 0.6, tightness: 0.8, placement: 1.5 },
    maxCandidateWalls: Math.max(0, maxWalls),
    timeBudgetMs: 50,
  };
  return buildRootCandidates(
    state,
    board,
    own,
    playerId,
    profile,
    { pressure: 'NORMAL', intent: 'NONE', extraDepth: 0, restrict: false, winningCells: new Set(), blockingSlots: new Set(), escapeCells: new Set(), reason: '' },
    Date.now() + 1000
  ).map((c) => c.action);
}
