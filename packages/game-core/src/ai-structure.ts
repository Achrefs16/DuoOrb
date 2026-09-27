/**
 * AI-ONLY structural analysis for DuoOrb.
 *
 * Nothing in this file can change a game. It reads a `GameState` and reports
 * board *structure* — regions, exits, gates, enclosure cost, wall chains,
 * routes, route diversity, territory — so the AI can reason about corridors,
 * funnels, enclosures and chokepoints instead of about raw distance alone.
 *
 * The rules modules (`ruleset` / `movement` / `walls` / `pathfinding` /
 * `geometry`) are untouched. Everything here is assembled from their exported
 * primitives plus local, allocation-free scans, so the authoritative rule
 * surface stays the single source of truth.
 *
 * WHY THIS EXISTS
 * Distance alone cannot tell a single-file corridor from an open board, and it
 * cannot tell a player who is one wall away from being sealed from one who has
 * nine exits. Those are exactly the situations a tactical board game turns on,
 * so the AI needs to see them. This module is the "eyes"; `ai.ts` is the
 * "hands" and the judgement.
 *
 * COST MODEL (the AI runs this on a phone's JS thread)
 * Every routine is O(81 + walls) per board, and results are memoised per search
 * epoch so a single turn pays for each analysis once:
 *
 *   - one wall-field analysis per distinct wall set  (chains, extensions),
 *   - one region flood per distinct wall set          (sizes, exits, gates,
 *                                                      seal cost, territory),
 *   - two BFS per distinct (wall set, player square)  (distance, route
 *                                                      diversity, first steps,
 *                                                      viable goal cells).
 *
 * Sharing a wall set across sibling candidates is what makes it affordable: all
 * wall candidates of one turn share the flood, and only the distances have to
 * be re-measured per wall. Typed arrays are pooled module-wide, exactly like
 * `pathfinding.ts` does, and nothing escapes the synchronous call that fills
 * them.
 */
import { BOARD_SIZE, WALL_GRID_SIZE } from './constants.js';
import { buildWallIndex, doesWallConflict, wallSlotIndex } from './geometry.js';
import { cellToIndex, indexToCell, isGoalCell } from './pathfinding.js';
import type {
  CellCoord,
  GameMode,
  GameState,
  GoalDirection,
  Orientation,
  PlayerState,
  WallCoord,
} from './types.js';

/** Bumped whenever the structural model changes shape, so caches can be flushed. */
export const STRUCTURE_VERSION = 'ai-structure-1';

const CELLS = BOARD_SIZE * BOARD_SIZE;
const UNREACHED = -1;

/** Shortest-path multiplicity cap: a wide-open board would otherwise overflow. */
export const PATH_COUNT_CAP = 4096;
/** Forks past this are indistinguishable for the AI ("corridor plus one escape"). */
export const FORK_CAP = 64;
/** Reported optimal first steps are bounded: they drive move ordering, not a search. */
export const MAX_FIRST_STEPS = 8;
/** Reported reachable-goal cells are bounded for the same reason. */
export const MAX_GOAL_CELLS = 16;
/** Reported boundary slots per region: candidate generation is bounded on purpose. */
export const MAX_EXIT_SLOTS = 12;
/** Reported cells of one optimal route: enough to aim wall candidates. */
export const MAX_ROUTE_CELLS = 8;
/** A board holds 128 slots, so no chain can be longer; the cap is a guard only. */
export const MAX_CHAIN_SLOTS = 128;
/** Wall-chain probing is bounded so a long board can never blow the budget. */
export const MAX_CHAIN_EXTENSIONS = 12;

/** Direction order is fixed so every scan in this file is deterministic. */
const DR = [-1, 1, 0, 0] as const;
const DC = [0, 0, -1, 1] as const;

/** Cap above which "how many options do I have" stops growing. */
const ROOM_CAP = 48;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

export function slotKey(wall: WallCoord): string {
  return `${wall.row},${wall.col},${wall.orientation}`;
}

export function cellKey(cell: CellCoord): string {
  return `${cell.row},${cell.col}`;
}

/**
 * Packed form of a wall slot: row * 16 + col * 2 + orientation, so it fits in a
 * small integer. The AI builds its candidate pool in a Map keyed by these, which
 * keeps the hot path free of string allocation — the old scan order was
 * re-deriving a string key for every slot at every search node.
 */
export function packSlot(wall: WallCoord): number {
  return wall.row * 16 + wall.col * 2 + (wall.orientation === 'V' ? 1 : 0);
}

export function unpackSlot(packed: number): WallCoord {
  return {
    row: Math.floor(packed / 16),
    col: Math.floor(packed / 2) % 8,
    orientation: packed % 2 === 1 ? 'V' : 'H',
  };
}

/** Packed form of a cell: row * 9 + col, in 0..80. */
export function packCell(cell: CellCoord): number {
  return cell.row * 9 + cell.col;
}

export function unpackCell(packed: number): CellCoord {
  return { row: Math.floor(packed / 9), col: packed % 9 };
}

/**
 * O(1) equivalent of `doesWallConflict` against a prebuilt packed index.
 *
 * Every rule in `doesWallConflict` is a lookup on the 8x8 slot lattice: the same
 * slot, the cross at a shared intersection, or a same-orientation neighbour that
 * overlaps by one cell. The AI runs this on every probed slot of every search
 * node, so it must not walk the wall array.
 */
export function slotConflicts(index: Uint8Array, wall: WallCoord): boolean {
  const { row, col, orientation } = wall;
  if (row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE) return true;
  const own = orientation === 'V' ? 1 : 0;
  // Same slot, or the perpendicular wall crossing at this intersection.
  if (index[(row * WALL_GRID_SIZE + col) * 2 + own] === 1) return true;
  if (index[(row * WALL_GRID_SIZE + col) * 2 + (1 - own)] === 1) return true;
  if (own === 0) {
    if (hasWall(index, row, col - 1, 0)) return true;
    if (hasWall(index, row, col + 1, 0)) return true;
  } else {
    if (hasWall(index, row - 1, col, 1)) return true;
    if (hasWall(index, row + 1, col, 1)) return true;
  }
  return false;
}

export function slotFromKey(key: string): WallCoord {
  const parts = key.split(',');
  return { row: Number(parts[0]), col: Number(parts[1]), orientation: parts[2] as Orientation };
}

const parseSlot = slotFromKey;

/**
 * Canonical key for a wall set. Sorted so two states that differ only in the
 * order walls were recorded share every cache entry (and every transposition
 * key) — walls have no order in the game.
 */
export function wallSetKey(walls: readonly WallCoord[]): string {
  if (walls.length === 0) return '';
  return walls.map((w) => `${w.row},${w.col},${w.orientation}`).sort().join(';');
}

// ---------------------------------------------------------------------------
// Allocation-free wall lookups
// ---------------------------------------------------------------------------

function hasWall(index: Uint8Array, row: number, col: number, orientation: 0 | 1): boolean {
  if (row < 0 || row >= WALL_GRID_SIZE || col < 0 || col >= WALL_GRID_SIZE) return false;
  return index[(row * WALL_GRID_SIZE + col) * 2 + orientation] === 1;
}

/**
 * Whether a step in direction `d` out of (row, col) is blocked by a wall.
 * Mirrors `isBlockedByWallIndexed` in `geometry.ts` exactly, but is inlined so
 * the AI's inner loops allocate nothing. Direction order matches DR/DC above.
 */
function blockedByWall(index: Uint8Array, row: number, col: number, d: number): boolean {
  switch (d) {
    case 0: // up -> (row-1, col)
      return hasWall(index, row - 1, col, 0) || hasWall(index, row - 1, col - 1, 0);
    case 1: // down -> (row+1, col)
      return hasWall(index, row, col, 0) || hasWall(index, row, col - 1, 0);
    case 2: // left -> (row, col-1)
      return hasWall(index, row, col - 1, 1) || hasWall(index, row - 1, col - 1, 1);
    default: // right -> (row, col+1)
      return hasWall(index, row, col, 1) || hasWall(index, row - 1, col, 1);
  }
}

/**
 * Writes the cell indices of the open orthogonal neighbours of (row, col) into
 * `out` and returns how many were written. No allocation, fixed direction
 * order, so callers get deterministic neighbour sequences.
 */
export function openNeighbours(
  index: Uint8Array,
  row: number,
  col: number,
  out: Int32Array
): number {
  let n = 0;
  for (let d = 0; d < 4; d++) {
    const nr = row + DR[d];
    const nc = col + DC[d];
    if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
    if (blockedByWall(index, row, col, d)) continue;
    out[n++] = nr * BOARD_SIZE + nc;
  }
  return n;
}

/**
 * Every wall slot that can block a step out of (row, col) in direction `d`.
 * One cell step is crossed by exactly two wall slots, which is why a single
 * wall can close two openings of the same corridor.
 */
export function slotsBlockingStep(row: number, col: number, d: number): WallCoord[] {
  const out: WallCoord[] = [];
  const push = (r: number, c: number, o: Orientation) => {
    if (r < 0 || r >= WALL_GRID_SIZE || c < 0 || c >= WALL_GRID_SIZE) return;
    out.push({ row: r, col: c, orientation: o });
  };
  switch (d) {
    case 0:
      push(row - 1, col, 'H');
      push(row - 1, col - 1, 'H');
      break;
    case 1:
      push(row, col, 'H');
      push(row, col - 1, 'H');
      break;
    case 2:
      push(row, col - 1, 'V');
      push(row - 1, col - 1, 'V');
      break;
    default:
      push(row, col, 'V');
      push(row - 1, col, 'V');
      break;
  }
  return out;
}

/**
 * Every wall slot that touches (not necessarily blocks) a cell: the four 'H'
 * and four 'V' slots whose segments end at one of the cell's four corners.
 * These are the slots that decide what a cell can see, so they are the useful
 * aiming points both for building and for breaking structure.
 */
export function slotsTouchingCell(row: number, col: number): WallCoord[] {
  const out: WallCoord[] = [];
  for (const o of ['H', 'V'] as const) {
    for (const dr of [-1, 0]) {
      for (const dc of [-1, 0]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= WALL_GRID_SIZE || c < 0 || c >= WALL_GRID_SIZE) continue;
        out.push({ row: r, col: c, orientation: o });
      }
    }
  }
  return out;
}

/**
 * Packed-slot variants of the two probes above, writing into caller-owned
 * scratch. Same results, zero allocation: the AI calls these at every node of
 * every search, and an array per touched cell is the difference between
 * completing a ply and being truncated by the clock.
 *
 * `out` receives packed slot ids (row * 16 + col * 2 + orientation).
 */
const slotScratch = new Int32Array(8);

export function packedSlotsBlockingStep(row: number, col: number, out: Int32Array): number {
  let n = 0;
  const push = (r: number, c: number, o: 0 | 1) => {
    if (r < 0 || r >= WALL_GRID_SIZE || c < 0 || c >= WALL_GRID_SIZE) return;
    out[n++] = r * 16 + c * 2 + o;
  };
  if (row > 0) {
    // up -> (row-1, col)
    push(row - 1, col, 0);
    push(row - 1, col - 1, 0);
  }
  if (row < BOARD_SIZE - 1) {
    // down -> (row+1, col)
    push(row, col, 0);
    push(row, col - 1, 0);
  }
  if (col > 0) {
    // left -> (row, col-1)
    push(row, col - 1, 1);
    push(row - 1, col - 1, 1);
  }
  if (col < BOARD_SIZE - 1) {
    // right -> (row, col+1)
    push(row, col, 1);
    push(row - 1, col, 1);
  }
  return n;
}

export function packedSlotsTouchingCell(row: number, col: number, out: Int32Array): number {
  let n = 0;
  for (const o of [0, 1] as const) {
    for (const dr of [-1, 0]) {
      const r = row + dr;
      if (r < 0 || r >= WALL_GRID_SIZE) continue;
      for (const dc of [-1, 0]) {
        const c = col + dc;
        if (c < 0 || c >= WALL_GRID_SIZE) continue;
        out[n++] = r * 16 + c * 2 + o;
      }
    }
  }
  return n;
}

const neighbourScratch = new Int32Array(4);

// ---------------------------------------------------------------------------
// Wall field: chains, ends, turns, extensions, bridges
// ---------------------------------------------------------------------------

/**
 * One connected run of walls. A chain is the AI's unit of *intent*: a wall
 * dropped beside a chain extends it, a perpendicular wall turns it, and a wall
 * touching two chains bridges them. Purely reactive wall play can never build
 * any of that, which is why chain-aware candidates matter.
 */
export interface WallChain {
  /** Slots in the chain, in discovery order. */
  slots: WallCoord[];
  /** Chain slots with fewer than two same-chain neighbours: a free end. */
  ends: WallCoord[];
  /** Empty slots that would extend this chain. */
  extensions: WallCoord[];
  /** Of those, the ones that would also merge this chain with another. */
  bridges: WallCoord[];
  /** Adjacent same-chain pairs whose orientation differs. */
  turns: number;
  /** True when the chain has no free end (a closed ring). */
  closed: boolean;
}

export interface WallField {
  /** Canonical wall-set key; part of the board cache key together with the mode. */
  key: string;
  /** Packed 128-slot occupancy, the same layout `geometry.ts` uses. */
  index: Uint8Array;
  chains: WallChain[];
  /** Every empty slot that extends some chain, deduped and bounded. */
  extensions: WallCoord[];
  /** Empty slots that would merge two different chains. */
  bridges: WallCoord[];
  /** slotKey -> number of distinct chains that slot touches. */
  chainTouch: Map<string, number>;
  /**
   * Extension slots that would turn a chain rather than continue it. Building
   * an L instead of a straight line is what actually funnels somebody: a wall
   * you can go around is a tempo cost, a wall that turns back on itself is a
   * commitment.
   */
  turnExtensions: Set<string>;
}

/** Lattice endpoints of a wall slot. Two slots are adjacent iff these meet. */
function latticePoints(wall: WallCoord): [string, string] {
  return wall.orientation === 'H'
    ? [`${wall.row},${wall.col}`, `${wall.row},${wall.col + 1}`]
    : [`${wall.row},${wall.col}`, `${wall.row + 1},${wall.col}`];
}

/** Every wall slot that meets the lattice point (r, c). Exactly four. */
function slotsAtLatticePoint(row: number, col: number): WallCoord[] {
  const out: WallCoord[] = [];
  if (row >= 0 && row < WALL_GRID_SIZE && col >= 0 && col < WALL_GRID_SIZE) {
    out.push({ row, col, orientation: 'H' });
  }
  if (row >= 0 && row < WALL_GRID_SIZE && col - 1 >= 0) {
    out.push({ row, col: col - 1, orientation: 'H' });
  }
  if (row - 1 >= 0 && row - 1 < WALL_GRID_SIZE && col >= 0 && col < WALL_GRID_SIZE) {
    out.push({ row: row - 1, col, orientation: 'V' });
  }
  if (row >= 0 && row < WALL_GRID_SIZE && col >= 0 && col < WALL_GRID_SIZE) {
    out.push({ row, col, orientation: 'V' });
  }
  return out;
}

export function buildWallField(walls: readonly WallCoord[]): WallField {
  const index = buildWallIndex(walls as WallCoord[]);
  const occupied = new Map<string, WallCoord>();
  for (const w of walls) {
    if (w.row < 0 || w.row >= WALL_GRID_SIZE || w.col < 0 || w.col >= WALL_GRID_SIZE) continue;
    occupied.set(slotKey(w), { row: w.row, col: w.col, orientation: w.orientation });
  }

  const chainOf = new Map<string, number>();
  const chains: WallChain[] = [];

  // Connected components over the 8x8 lattice of intersections. A chain is a run
  // of walls that physically touch, so this is exactly the "one line of walls"
  // the AI thinks in.
  for (const start of occupied.keys()) {
    if (chainOf.has(start)) continue;
    const id = chains.length;
    const members: string[] = [];
    const stack: string[] = [start];
    chainOf.set(start, id);
    while (stack.length > 0) {
      const current = stack.pop() as string;
      members.push(current);
      const wall = occupied.get(current);
      if (!wall) continue;
      for (const point of latticePoints(wall)) {
        const [pr, pc] = point.split(',').map(Number);
        for (const other of slotsAtLatticePoint(pr, pc)) {
          const otherKey = slotKey(other);
          if (!occupied.has(otherKey) || chainOf.has(otherKey)) continue;
          chainOf.set(otherKey, id);
          stack.push(otherKey);
        }
      }
    }
    chains.push({
      slots: members.map(parseSlot),
      ends: [],
      extensions: [],
      bridges: [],
      turns: 0,
      closed: false,
    });
  }

  // Full neighbour lists, built separately from the decomposition above. Doing
  // it inside the walk would only record the neighbours discovered *from* each
  // slot, which is one-sided and quietly undercounts ends and turns.
  const adjacency = new Map<string, string[]>();
  for (const key of occupied.keys()) {
    const wall = occupied.get(key) as WallCoord;
    const neighbours: string[] = [];
    for (const point of latticePoints(wall)) {
      const [pr, pc] = point.split(',').map(Number);
      for (const other of slotsAtLatticePoint(pr, pc)) {
        const otherKey = slotKey(other);
        if (otherKey !== key && occupied.has(otherKey)) neighbours.push(otherKey);
      }
    }
    adjacency.set(key, neighbours);
  }

  // Ends, turns and per-chain extension candidates.
  const extensionChains = new Map<string, number>();
  const turnExtensions = new Set<string>();
  for (let id = 0; id < chains.length; id++) {
    const chain = chains[id];
    const extensions = new Set<string>();
    let turnPairs = 0;
    for (const wall of chain.slots) {
      const key = slotKey(wall);
      const neighbours = adjacency.get(key) ?? [];
      let sameChain = 0;
      for (const neighbour of neighbours) {
        if (chainOf.get(neighbour) !== id) continue;
        sameChain++;
        const other = occupied.get(neighbour);
        if (other && other.orientation !== wall.orientation) turnPairs++;
      }
      if (sameChain < 2) chain.ends.push(wall);

      // Extensions are found by PROBING the four slots at each lattice point of
      // this wall. They cannot be read out of the lattice map, because that map
      // only holds walls that are actually on the board.
      for (const point of latticePoints(wall)) {
        const [pr, pc] = point.split(',').map(Number);
        for (const other of slotsAtLatticePoint(pr, pc)) {
          const otherKey = slotKey(other);
          if (occupied.has(otherKey)) continue;
          if (extensions.size >= MAX_CHAIN_EXTENSIONS) continue;
          extensions.add(otherKey);
          if (other.orientation !== wall.orientation) turnExtensions.add(otherKey);
        }
      }
    }
    chain.turns = Math.floor(turnPairs / 2);
    chain.closed = chain.ends.length === 0;
    chain.extensions = [...extensions].map(parseSlot);
    for (const key of extensions) {
      extensionChains.set(key, (extensionChains.get(key) ?? 0) + 1);
    }
  }

  const extensions: WallCoord[] = [];
  const bridges: WallCoord[] = [];
  const chainTouch = new Map<string, number>();
  for (const [key, chains_] of extensionChains) {
    chainTouch.set(key, chains_);
    const wall = parseSlot(key);
    extensions.push(wall);
    if (chains_ >= 2) bridges.push(wall);
  }
  const bridgeKeys = new Set(bridges.map(slotKey));
  for (const chain of chains) {
    chain.bridges = chain.extensions.filter((w) => bridgeKeys.has(slotKey(w)));
  }

  return {
    key: wallSetKey(walls),
    index,
    chains,
    extensions,
    bridges,
    chainTouch,
    turnExtensions,
  };
}

// ---------------------------------------------------------------------------
// Regions: territory, exits, gates, enclosure cost
// ---------------------------------------------------------------------------

/**
 * Wall-separated regions of the board.
 *
 * Occupied orbs deliberately do NOT split regions: an orb can be jumped, so it
 * is an obstacle on a route, not a wall.
 *
 * Worth knowing about this model before trusting it for tactics: a legal wall
 * set either leaves the whole board as one region, or it has closed a loop and
 * cut off a pocket. A partial barrier cannot split the board, because a single
 * lattice row only has four non-conflicting wall slots and one gap always
 * survives. So `exitEdges` is a *sealed or not* signal, not a funnel width —
 * corridor pressure is measured by `tightest` and `reach` on the route instead,
 * and those do vary from move to move.
 */
export interface RegionInfo {
  /** Cell index -> region id. */
  label: Int8Array;
  /** Region id -> number of cells. */
  sizes: number[];
  /** Region id -> open edges leaving it. Zero means sealed in. */
  exitEdges: number[];
}

export function computeRegions(index: Uint8Array): RegionInfo {
  const label = new Int8Array(CELLS).fill(-1);
  const sizes: number[] = [];
  const exitEdges: number[] = [];
  const queue = new Int32Array(CELLS);
  const cells: number[] = [];

  for (let start = 0; start < CELLS; start++) {
    if (label[start] !== -1) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    label[start] = id;
    cells.length = 0;
    while (head < tail) {
      const current = queue[head++];
      cells.push(current);
      const row = Math.floor(current / BOARD_SIZE);
      const col = current % BOARD_SIZE;
      const open = openNeighbours(index, row, col, neighbourScratch);
      for (let i = 0; i < open; i++) {
        const next = neighbourScratch[i];
        if (label[next] !== -1) continue;
        label[next] = id;
        queue[tail++] = next;
      }
    }

    let exits = 0;
    for (const current of cells) {
      const row = Math.floor(current / BOARD_SIZE);
      const col = current % BOARD_SIZE;
      for (let d = 0; d < 4; d++) {
        const nr = row + DR[d];
        const nc = col + DC[d];
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
        if (blockedByWall(index, row, col, d)) continue;
        if (label[nr * BOARD_SIZE + nc] === id) continue;
        exits++;
      }
    }
    sizes.push(cells.length);
    exitEdges.push(exits);
  }

  return { label, sizes, exitEdges };
}

// ---------------------------------------------------------------------------
// Board structure (per wall set + mode)
// ---------------------------------------------------------------------------

export interface BoardStructure {
  /** `mode|walls` — the cache key for everything below. */
  key: string;
  mode: GameMode;
  field: WallField;
  region: RegionInfo;
}

export function computeBoardStructure(
  mode: GameMode,
  walls: readonly WallCoord[],
  key: string
): BoardStructure {
  const field = buildWallField(walls);
  return { key, mode, field, region: computeRegions(field.index) };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Everything the AI needs to know about one player's route, from two BFS.
 *
 * `goalCells` and `firstSteps` are the two facts plain distance throws away:
 * how many different winning squares are still reachable (viable top-row exits
 * in a race) and how many squares start an equally short route (is this a
 * corridor with one way through, or an open board with four?). `exitEdges` and
 * `wallsToSeal` say whether that route is about to be taken away.
 */
export interface RouteProfile {
  playerId: string;
  /** Steps to the nearest reachable goal square; Infinity when sealed out. */
  distance: number;
  /** Distinct shortest routes to the nearest goal LAYER, capped. */
  pathCount: number;
  /** Every square that starts an equally short route, bounded. */
  firstSteps: CellCoord[];
  /**
   * Goal squares this player can still reach AT ALL, whatever the cost.
   *
   * This is the "viable exits" measure, and it is the one that varies: a player
   * walking an open bottom row can finish on any of nine top-row squares, and a
   * player funnelled into one column can only finish on one. Distance cannot
   * tell those apart — both report the same number of steps — so a mode where
   * the whole goal edge is shared (every race) is decided by this count.
   */
  goalCells: number;
  /** Goal squares at the exact minimum distance: where a win happens first. */
  nearestGoals: number;
  /** A few of those nearest goal squares, for aiming exit denial. */
  goalCellsNear: CellCoord[];
  /** One optimal route, start-first, bounded. */
  nearCells: CellCoord[];
  /** Region the player currently occupies. */
  region: number;
  /** Cells in that region. */
  regionSize: number;
  /** Open edges leaving that region. Zero means sealed in. */
  exitEdges: number;
  /** Open orthogonal edges out of this player's own square: 1 is a dead end. */
  openings: number;
  /**
   * Narrowest point on the optimal route, in open edges, including the square the
   * player stands on.
   *
   * This is the corridor measure that actually varies in a real game. Region
   * counts barely move — a legal wall set either leaves the board one region or
   * cuts off a sealed pocket — and neither does the count of reachable goal
   * squares, because the goal edge is always connected and always reachable. How
   * wide the tightest square still ahead is, on the other hand, changes with
   * every wall anybody plays.
   */
  tightest: number;
  /**
   * Cells still reachable within `distance + FLEXIBILITY_SLACK`.
   *
   * Distance-limited territory: this is the room that matters, because the cells
   * two steps beyond the line are options and the rest of the board is scenery.
   * It shrinks the moment walls box somebody in, which total region size never
   * does.
   */
  reach: number;
  /** False only in positions the rules should already have forbidden. */
  hasGoalAccess: boolean;
}

/** How far past the line still counts as options rather than scenery. */
export const FLEXIBILITY_SLACK = 2;

const distScratch = new Int16Array(CELLS);
const countScratch = new Int32Array(CELLS);
const queueScratch = new Int32Array(CELLS);
const goalScratch = new Int32Array(MAX_GOAL_CELLS);

/**
 * Distance to the goal LAYER for every square, one BFS per (wall set, goal
 * edge) rather than one per (wall set, player square).
 *
 * This is the single most valuable cache in the file. The forward BFS from a
 * player is unavoidable, but "how many steps is this square from the nearest
 * winning square" depends only on the walls and which edge is the goal — not on
 * where anybody is standing. Almost every leaf of a search shares a wall set
 * with its siblings, so this turns two BFS per player per leaf into one.
 */
const goalFieldCache = new Map<string, Int16Array>();
const GOAL_FIELD_LIMIT = 512;

function goalDistanceField(board: BoardStructure, goal: GoalDirection): Int16Array {
  const key = `${board.key}|${goal}`;
  const hit = goalFieldCache.get(key);
  if (hit) return hit;

  const dist = new Int16Array(CELLS).fill(UNREACHED);
  const queue = new Int32Array(CELLS);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < CELLS; i++) {
    if (!isGoalCell(indexToCell(i), goal, board.mode)) continue;
    dist[i] = 0;
    queue[tail++] = i;
  }
  while (head < tail) {
    const current = queue[head++];
    const next = dist[current] + 1;
    const row = Math.floor(current / BOARD_SIZE);
    const col = current % BOARD_SIZE;
    const open = openNeighbours(board.field.index, row, col, neighbourScratch);
    for (let i = 0; i < open; i++) {
      const neighbour = neighbourScratch[i];
      if (dist[neighbour] !== UNREACHED) continue;
      dist[neighbour] = next;
      queue[tail++] = neighbour;
    }
  }
  if (goalFieldCache.size >= GOAL_FIELD_LIMIT) goalFieldCache.clear();
  goalFieldCache.set(key, dist);
  return dist;
}

function computeRoute(board: BoardStructure, player: PlayerState): RouteProfile {
  const mode = board.mode;
  const goal = player.goalDirection;
  const start = player.position;
  const startIndex = cellToIndex(start);
  const region = board.region.label[startIndex];

  const base: RouteProfile = {
    playerId: player.id,
    distance: Infinity,
    pathCount: 0,
    firstSteps: [],
    goalCells: 0,
    nearestGoals: 0,
    goalCellsNear: [],
    nearCells: [start],
    region,
    regionSize: board.region.sizes[region] ?? 1,
    exitEdges: board.region.exitEdges[region] ?? 0,
    openings: openNeighbours(board.field.index, start.row, start.col, neighbourScratch),
    tightest: 4,
    reach: 1,
    hasGoalAccess: false,
  };

  if (isGoalCell(start, goal, mode)) {
    return {
      ...base,
      distance: 0,
      pathCount: 1,
      goalCells: 1,
      nearestGoals: 1,
      goalCellsNear: [start],
      hasGoalAccess: true,
    };
  }

  // Forward BFS: distance and shortest-route multiplicity in one sweep.
  const dist = distScratch;
  const count = countScratch;
  const queue = queueScratch;
  dist.fill(UNREACHED);
  count.fill(0);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  dist[startIndex] = 0;
  count[startIndex] = 1;
  while (head < tail) {
    const current = queue[head++];
    const next = dist[current] + 1;
    const currentCount = count[current];
    const row = Math.floor(current / BOARD_SIZE);
    const col = current % BOARD_SIZE;
    const open = openNeighbours(board.field.index, row, col, neighbourScratch);
    for (let i = 0; i < open; i++) {
      const neighbour = neighbourScratch[i];
      const seen = dist[neighbour];
      if (seen === UNREACHED) {
        dist[neighbour] = next;
        count[neighbour] = currentCount;
        queue[tail++] = neighbour;
      } else if (seen === next && count[neighbour] < PATH_COUNT_CAP) {
        count[neighbour] = Math.min(PATH_COUNT_CAP, count[neighbour] + currentCount);
      }
    }
  }

  // Reachable goal squares (viable exits), and the nearest layer of them.
  let minDistance = Infinity;
  let reachableGoals = 0;
  for (let i = 0; i < CELLS; i++) {
    if (dist[i] === UNREACHED || !isGoalCell(indexToCell(i), goal, mode)) continue;
    reachableGoals++;
    if (dist[i] < minDistance) minDistance = dist[i];
  }
  if (minDistance === Infinity) return base;

  let nearestGoals = 0;
  let pathCount = 0;
  let anchor = -1;
  for (let i = 0; i < CELLS; i++) {
    if (dist[i] !== minDistance || !isGoalCell(indexToCell(i), goal, mode)) continue;
    if (anchor < 0) anchor = i;
    if (nearestGoals < MAX_GOAL_CELLS) goalScratch[nearestGoals] = i;
    nearestGoals++;
    if (pathCount < PATH_COUNT_CAP) pathCount = Math.min(PATH_COUNT_CAP, pathCount + count[i]);
  }

  // Backward BFS from the whole nearest goal layer. A neighbour of the start
  // is an optimal first step exactly when it sits one step closer to that
  // layer, which is what "corridor with one exit vs open board with choices"
  // reduces to. The layer distances are cached per wall set, not per square.
  const toGoal = goalDistanceField(board, goal);
  const firstSteps: CellCoord[] = [];
  const openFromStart = openNeighbours(board.field.index, start.row, start.col, neighbourScratch);
  for (let i = 0; i < openFromStart; i++) {
    if (firstSteps.length >= MAX_FIRST_STEPS) break;
    const neighbour = neighbourScratch[i];
    if (toGoal[neighbour] === minDistance - 1) firstSteps.push(indexToCell(neighbour));
  }

  // Distance-limited territory and the narrowest point on the route: the two
  // measures that actually respond to a board being closed up.
  const reachLimit = minDistance + FLEXIBILITY_SLACK;
  let reach = 0;
  for (let i = 0; i < CELLS; i++) {
    if (dist[i] !== UNREACHED && dist[i] <= reachLimit) reach++;
  }

  // Corridor pressure over the WHOLE optimal route, not just the window reported
  // in `nearCells`: on a long detour the interesting square is the one the player
  // is standing next to, and that is exactly the cell a truncated window misses.
  // A cell is on an optimal route exactly when its two distances add up, and the
  // goal squares themselves are skipped — how open the winning square is says
  // nothing.
  let tightest = 4;
  for (let i = 0; i < CELLS; i++) {
    if (dist[i] === UNREACHED || toGoal[i] === UNREACHED) continue;
    if (dist[i] + toGoal[i] !== minDistance) continue;
    if (isGoalCell(indexToCell(i), goal, mode)) continue;
    const degree = openNeighbours(
      board.field.index,
      Math.floor(i / BOARD_SIZE),
      i % BOARD_SIZE,
      neighbourScratch
    );
    if (degree < tightest) tightest = degree;
  }

  // One optimal route, walked back from an anchor square. Deterministic: the
  // first neighbour one step closer in the forward BFS wins, direction order is
  // fixed.
  const nearCells: CellCoord[] = [];
  let cursor = anchor;
  let guard = 0;
  while (cursor >= 0 && nearCells.length < MAX_ROUTE_CELLS && guard++ <= MAX_ROUTE_CELLS + 1) {
    nearCells.push(indexToCell(cursor));
    if (cursor === startIndex) break;
    const row = Math.floor(cursor / BOARD_SIZE);
    const col = cursor % BOARD_SIZE;
    let step = -1;
    for (let d = 0; d < 4 && step < 0; d++) {
      const nr = row + DR[d];
      const nc = col + DC[d];
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      if (blockedByWall(board.field.index, row, col, d)) continue;
      const candidate = nr * BOARD_SIZE + nc;
      if (dist[candidate] === dist[cursor] - 1) step = candidate;
    }
    cursor = step;
  }
  nearCells.reverse();

  return {
    playerId: player.id,
    distance: minDistance,
    pathCount,
    firstSteps,
    goalCells: Math.min(reachableGoals, MAX_GOAL_CELLS),
    nearestGoals,
    goalCellsNear: Array.from(goalScratch.slice(0, Math.min(nearestGoals, 4))).map(indexToCell),
    nearCells,
    region,
    regionSize: base.regionSize,
    exitEdges: base.exitEdges,
    openings: base.openings,
    tightest,
    reach,
    hasGoalAccess: true,
  };
}

// ---------------------------------------------------------------------------
// Epoch-scoped caches
// ---------------------------------------------------------------------------

/**
 * Caches live for one search "epoch" — one root turn, or one analysis call.
 * `beginEpoch` throws them away, so memory is bounded by the largest single
 * search rather than by the length of a session, and a position can never be
 * answered from a stale structural model.
 */
let epoch = 0;
const boardCache = new Map<string, BoardStructure>();
const routeCache = new Map<string, RouteProfile>();

/** Hard caps: exceeded caches are dropped wholesale, which is cheap and safe. */
const BOARD_CACHE_LIMIT = 512;
const ROUTE_CACHE_LIMIT = 8192;

let lastState: GameState | null = null;
let lastBoard: BoardStructure | null = null;

export function beginEpoch(): void {
  epoch++;
  boardCache.clear();
  routeCache.clear();
  goalFieldCache.clear();
  lastState = null;
  lastBoard = null;
}

export function currentEpoch(): number {
  return epoch;
}

/** Structural view of a state's wall set. Identity-cached per state object. */
export function boardOf(state: GameState): BoardStructure {
  if (state === lastState && lastBoard) return lastBoard;
  const key = `${state.mode}|${wallSetKey(state.walls)}`;
  let board = boardCache.get(key);
  if (!board) {
    board = computeBoardStructure(state.mode, state.walls, key);
    if (boardCache.size >= BOARD_CACHE_LIMIT) boardCache.clear();
    boardCache.set(key, board);
  }
  lastState = state;
  lastBoard = board;
  return board;
}

/** Route view of one player on one board. */
export function routeOf(
  state: GameState,
  board: BoardStructure,
  player: PlayerState
): RouteProfile {
  const key = `${board.key}|${player.id}|${player.position.row},${player.position.col}|${player.goalDirection}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const route = computeRoute(board, player);
  if (routeCache.size >= ROUTE_CACHE_LIMIT) routeCache.clear();
  routeCache.set(key, route);
  return route;
}

// ---------------------------------------------------------------------------
// Shared structural scores
// ---------------------------------------------------------------------------

/**
 * Saturating "how many options does this player have left", from
 * distance-limited territory.
 *
 * Deliberately not the size of the wall-separated region: a legal wall set
 * either leaves the whole board as one region or cuts off a small sealed pocket,
 * so region size barely moves and tells you nothing about pressure. Reach —
 * the cells within a couple of steps of the line — shrinks the moment somebody
 * is funnelled, which is the thing worth pricing.
 */
export function roomScore(route: RouteProfile): number {
  return Math.log2(1 + Math.min(ROOM_CAP, Math.max(1, route.reach)));
}

/** Is this slot still free and not crossing an existing wall? */
export function slotIsFree(walls: readonly WallCoord[], wall: WallCoord): boolean {
  if (wall.row < 0 || wall.row >= WALL_GRID_SIZE) return false;
  if (wall.col < 0 || wall.col >= WALL_GRID_SIZE) return false;
  return !doesWallConflict(wall, walls as WallCoord[]);
}

/** Occupancy probe against a prebuilt packed index. */
export function slotIsOccupied(index: Uint8Array, wall: WallCoord): boolean {
  return index[wallSlotIndex(wall)] === 1;
}
