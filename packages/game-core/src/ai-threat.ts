/**
 * Strategic plan layer: what is the opponent BUILDING, not what they just did.
 *
 * The engine already understands individual walls — `WallInsight.delay` measures
 * exactly how much one placement lengthens a rival's route. What it could not
 * see was a *sequence*: walls that are individually weak or even individually
 * worthless, converging over three turns into a corridor that decides the game,
 * while our own pawn move scored one step better each time. That is the failure
 * this module exists to remove.
 *
 * Method, and why it is affordable
 * --------------------------------
 * Every question this layer asks has the same shape: "if these one or two slots
 * were filled, how much longer is my route?" `projectedGoalField()` answers it
 * with a single 81-cell BFS over the existing wall index — no structure
 * rebuild, no allocation. That is what makes it possible to ask about EVERY
 * legal slot on the board, and about PAIRS of the best ones, rather than about a
 * hand-picked handful. Pair analysis is the part that matters: a pair whose
 * combined cost is far more than the sum of its halves is a structure being
 * assembled, and no amount of single-wall reasoning will ever see it.
 *
 * Three questions, deliberately and only three:
 *
 *   bite        what the rival's best continuation costs me over two plies
 *   focus       are several of their slots aiming at ONE structure (intent)
 *               or scattered (noise)
 *   raceDecided can any of it still change the result
 *
 * No neural network, no rollout, no search. Bounded lookahead over cached
 * structural facts, evaluated once per root position.
 */
import {
  BoardStructure,
  RouteProfile,
  boardOf,
  cellToIndex,
  packSlot,
  packedSlotsTouchingCell,
  projectedGoalField,
  routeOf,
  slotConflicts,
  unpackSlot,
} from './ai-structure.js';
import type { GameAction, GameState, PlayerState, WallCoord } from './types.js';
import { applyAction } from './ruleset.js';
import { isLegalWallPlacement } from './walls.js';
import { doesWallConflict } from './geometry.js';

/** Individual continuation slots kept per rival, best first. */
const MAX_CONTINUATIONS = 4;
/** Rivals analysed. The nearest threats matter; the rest cannot all be real. */
const MAX_RIVALS = 3;
/** Pairs of continuations tested for superadditive (structural) effect. */
const MAX_PAIRS = 4;
/** Combined cost above which a pair counts as a structure rather than noise. */
const PAIR_ALERT = 2;
/** Ratio above which a pair costs more than its halves, i.e. it compounds. */
const PAIR_SUPERADDITIVE = 1.34;
/**
 * A rival with this many steps in hand and this many walls left can still
 * overturn the race. Derived, not tuned: a wall buys at most two steps of route
 * in practice, so `2 * wallsLeft` is the delay they can still threaten.
 */
const STEPS_PER_WALL = 2;

export interface ThreatWall {
  /** Slot the rival would play next. */
  packed: number;
  /** How much longer our route becomes if they play it alone. */
  delay: number;
  /** Extends an existing chain, so the structure visibly continues. */
  extendsChain: boolean;
  /**
   * Set on a slot that only becomes dangerous in combination. Its own delay can
   * be zero: this is the "individually harmless, structurally fatal" case.
   */
  pairDelay: number;
  /** Wall slots this one converges with, packed. */
  convergesWith: number[];
  /** Cost to the rival of playing it themselves, in steps. */
  theirCost: number;
}

export interface ThreatProfile {
  rivalId: string;
  rivalIndex: number;
  wallsLeft: number;
  /** Their continuation slots against us, worst-first, bounded. */
  walls: ThreatWall[];
  /**
   * Two-ply bite: the best combined cost of a plausible two-wall continuation.
   * One ply is already priced by `WallInsight.delay`; this is the part the search
   * never sees, because inner nodes generate no rival walls.
   */
  bite: number;
  /** A pair whose cost exceeds the sum of its halves: a structure, not a wall. */
  structural: boolean;
  /** True when a continuation actually lengthens our route. */
  targetsUs: boolean;
  /** True when the rival is close enough to the line for a wall to matter. */
  live: boolean;
  score: number;
  reason: string;
}

export interface StrategicRead {
  threats: ThreatProfile[];
  primary: ThreatProfile | null;
  /** Slots we may want to play to break the primary plan. */
  counters: number[];
  /** Two or more rivals independently threatening us. */
  multiThreat: boolean;
  /** Position is volatile: worth an extra ply and worth defending. */
  urgent: boolean;
  /** Our race is already beyond repair, so a plan cannot change the game. */
  raceDecided: boolean;
}

const EMPTY_READ: StrategicRead = {
  threats: [],
  primary: null,
  counters: [],
  multiThreat: false,
  urgent: false,
  raceDecided: false,
};

interface SlotScan {
  packed: number;
  delay: number;
  extendsChain: boolean;
}

/** Reused across calls so the scan allocates nothing per slot. */
const scanPacked = new Int32Array(160);
const scanDelay = new Int32Array(160);
const scanExtends = new Uint8Array(160);
const scanOrder = new Int32Array(160);

/**
 * Every legal slot that would lengthen our route, best first.
 *
 * Scanning the whole 8x8 lattice rather than the chain-extension list is the
 * deliberate change from the first draft. Restricting to slots that extend an
 * existing chain missed the commonest plan of all: a rival laying a NEW line,
 * one fresh wall per turn, where no single wall touches the previous one and
 * every individual placement is worthless. The lattice scan costs one BFS per
 * free slot and finds those.
 *
 * One BFS per slot, never two: an earlier draft also measured what the slot
 * cost the RIVAL, and nothing ever used the answer, so it doubled the most
 * expensive loop in the turn for nothing.
 */
function scanSlots(
  board: BoardStructure,
  me: PlayerState,
  myDistance: number,
  rivalHasWalls: boolean
): number {
  const index = board.field.index;
  const goal = me.goalDirection;
  const start = cellToIndex(me.position);
  let n = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const base = (row * 8 + col) * 2;
      for (let o = 0; o < 2; o++) {
        if (index[base + o] === 1) continue;
        const slot: WallCoord = { row, col, orientation: o === 1 ? 'V' : 'H' };
        if (slotConflicts(index, slot)) continue;
        const field = projectedGoalField(index, board.mode, goal, [slot]);
        const d = field[start];
        if (d < 0) continue;
        const delay = d - myDistance;
        if (delay <= 0) continue;
        if (n >= scanPacked.length) break;
        scanPacked[n] = row * 16 + col * 2 + o;
        scanDelay[n] = delay;
        scanExtends[n] = (board.field.chainTouch.get(`${row},${col},${o === 1 ? 'V' : 'H'}`) ?? 0) > 0 ? 1 : 0;
        n++;
      }
    }
  }
  // Insertion sort on (delay desc, packed asc): n is small and the comparator
  // is total, so the order is stable and identical on every run.
  for (let i = 1; i < n; i++) {
    const p = scanPacked[i];
    const d = scanDelay[i];
    const e = scanExtends[i];
    let j = i - 1;
    while (j >= 0 && (scanDelay[j] < d || (scanDelay[j] === d && scanPacked[j] > p))) {
      scanPacked[j + 1] = scanPacked[j];
      scanDelay[j + 1] = scanDelay[j];
      scanExtends[j + 1] = scanExtends[j];
      j--;
    }
    scanPacked[j + 1] = p;
    scanDelay[j + 1] = d;
    scanExtends[j + 1] = e;
  }
  for (let i = 0; i < n; i++) scanOrder[i] = i;
  void rivalHasWalls;
  return n;
}

/** Distance one rival would have to travel with `extras` hypothetically added. */
function distanceWith(
  board: BoardStructure,
  goal: PlayerState['goalDirection'],
  from: { row: number; col: number },
  extras: WallCoord[]
): number {
  const field = projectedGoalField(board.field.index, board.mode, goal, extras);
  const d = field[cellToIndex(from)];
  return d < 0 ? Infinity : d;
}

/**
 * Do the rival's best slots COMPOUND? Returns the strongest superadditive pair.
 *
 * This is the whole point of the module. Two walls that each cost me nothing can
 * together cost me four steps, and that is a funnel being built rather than two
 * unrelated walls. Pairs are drawn from the individually-best slots, bounded to
 * `MAX_PAIRS`, and only counted when the combined cost beats the sum of the
 * halves by a clear margin.
 *
 * A pair that leaves me with NO route at all is the single most dangerous thing
 * that can happen on the board, and it arrives here as an infinite distance. It
 * used to be skipped as unusable, which quietly threw away the sharpest case
 * the detector exists to find: two walls that each look harmless and together
 * seal the route. It is priced as `SEALED_COST` instead.
 */
const SEALED_COST = 40;

function strongestPair(
  board: BoardStructure,
  me: PlayerState,
  myDistance: number,
  n: number
): { combined: number; a: number; b: number } | null {
  let best: { combined: number; a: number; b: number } | null = null;
  const pool = Math.min(n, MAX_CONTINUATIONS);
  let pairs = 0;
  for (let i = 0; i < pool && pairs < MAX_PAIRS; i++) {
    for (let j = i + 1; j < pool && pairs < MAX_PAIRS; j++) {
      pairs++;
      const sa: WallCoord = unpackSlot(scanPacked[i]);
      const sb: WallCoord = unpackSlot(scanPacked[j]);
      const combined = distanceWith(board, me.goalDirection, me.position, [sa, sb]);
      const sum = scanDelay[i] + scanDelay[j];
      const gained = Number.isFinite(combined)
        ? combined - myDistance
        : sum > 0
          ? SEALED_COST
          : 0;
      if (gained < PAIR_ALERT) continue;
      if (Number.isFinite(combined) && gained < sum * PAIR_SUPERADDITIVE) continue;
      if (best === null || gained > best.combined) {
        best = { combined: gained, a: scanPacked[j], b: scanPacked[i] };
      }
    }
  }
  return best;
}

function continuationsAgainst(
  state: GameState,
  board: BoardStructure,
  me: PlayerState,
  rival: PlayerState,
  myRoute: RouteProfile
): { walls: ThreatWall[]; bite: number; structural: boolean } {
  if (!myRoute.hasGoalAccess) return { walls: [], bite: 0, structural: false };
  const myDistance = myRoute.distance;
  const n = scanSlots(board, me, myDistance, rival.wallsRemaining > 0);
  if (n === 0) return { walls: [], bite: 0, structural: false };

  const pair = strongestPair(board, me, myDistance, n);
  const walls: ThreatWall[] = [];
  for (let i = 0; i < Math.min(n, MAX_CONTINUATIONS); i++) {
    walls.push({
      packed: scanPacked[i],
      delay: scanDelay[i],
      extendsChain: scanExtends[i] === 1,
      pairDelay: 0,
      convergesWith: [],
      theirCost: 0,
    });
  }

  let bite = 0;
  if (pair) {
    bite = pair.combined;
    for (const wall of walls) {
      if (wall.packed === pair.a || wall.packed === pair.b) {
        wall.pairDelay = pair.combined;
        wall.convergesWith = [wall.packed === pair.a ? pair.b : pair.a];
      }
    }
  } else {
    bite = walls[0].delay;
  }

  return { walls, bite, structural: pair !== null };
}

/** Memoised per root state so repeated calls in one turn are free. */
let memoState: GameState | null = null;
let memoPlayerId: string | null = null;
let memoRead: StrategicRead = EMPTY_READ;

export function resetStrategicMemo(): void {
  memoState = null;
  memoPlayerId = null;
  memoRead = EMPTY_READ;
}

/**
 * The whole strategic layer, in one call: once per root position, bounded, and
 * cheap enough that it is invisible next to the search it feeds.
 */
export function readStrategicState(
  state: GameState,
  playerId: string,
  nearRivalDistance: number
): StrategicRead {
  if (state === memoState && playerId === memoPlayerId) return memoRead;
  const me = state.players.find((p) => p.id === playerId);
  if (state.status !== 'IN_PROGRESS' || !me) {
    memoState = state;
    memoPlayerId = playerId;
    memoRead = EMPTY_READ;
    return memoRead;
  }

  const board = boardOf(state);
  const myRoute = routeOf(state, board, me);

  // A decisive lead is only decisive against the walls the rivals still hold.
  // An opponent with six walls in hand can still add six or seven steps to my
  // route, so a three-step lead in the early game is NOT a win — which is
  // exactly the case the first draft got wrong by ignoring their inventory.
  let maxRivalWalls = 0;
  for (const p of state.players) {
    if (p.id !== playerId && p.status === 'ACTIVE') {
      maxRivalWalls = Math.max(maxRivalWalls, p.wallsRemaining);
    }
  }
  const lead = Number.isFinite(nearRivalDistance) ? nearRivalDistance - myRoute.distance : Infinity;
  const raceDecided =
    Number.isFinite(lead) && lead > Math.max(1, maxRivalWalls * STEPS_PER_WALL + 1);

  // Early out before the lattice scan. A decided race is the single most common
  // case in a won game, and the scan is the expensive part of this layer; there
  // is nothing for it to find, because no continuation can reach us.
  if (raceDecided || me.wallsRemaining <= 0 || !myRoute.hasGoalAccess) {
    const read: StrategicRead = { ...EMPTY_READ, raceDecided };
    memoState = state;
    memoPlayerId = playerId;
    memoRead = read;
    return read;
  }

  const threats: ThreatProfile[] = [];
  const ordered = state.players
    .filter((p) => p.id !== playerId && p.status === 'ACTIVE' && p.wallsRemaining > 0)
    .map((p) => ({ player: p, route: routeOf(state, board, p) }))
    .filter((entry) => entry.route.hasGoalAccess)
    .sort((a, b) => a.route.distance - b.route.distance)
    .slice(0, MAX_RIVALS);

  for (const entry of ordered) {
    const found = continuationsAgainst(state, board, me, entry.player, myRoute);
    if (found.walls.length === 0) continue;
    const live = entry.route.distance <= 4;
    const chains = found.walls.filter((w) => w.extendsChain).length;
    const score =
      found.bite * (found.structural ? 1.5 : 1) * (1 + 0.15 * chains) * (live ? 1 : 0.6);
    threats.push({
      rivalId: entry.player.id,
      rivalIndex: entry.player.index,
      wallsLeft: entry.player.wallsRemaining,
      walls: found.walls,
      bite: found.bite,
      structural: found.structural,
      targetsUs: found.walls[0].delay > 0 || found.structural,
      live,
      score,
      reason: `${entry.player.displayName}: bite ${found.bite}${
        found.structural ? ' as a two-wall structure' : ' from one wall'
      }`,
    });
  }

  threats.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.rivalIndex - b.rivalIndex));
  const primary = threats[0] ?? null;
  const multiThreat = threats.filter((t) => t.bite > 0).length >= 2;

  // The gate that keeps this from becoming a panicker.
  //
  // Stopping a plan is only worth a move if stopping it can CHANGE THE RESULT.
  // `bite` is what the plan costs me, so the plan is decisive exactly when the
  // race gap is no larger than the bite plus a step of tempo. That single test
  // covers both directions, and both mistakes the first draft made:
  //
  //   Behind by more than the bite  -> I lose either way, so RACE. Denying a
  //     plan that cannot catch up just wastes a turn, which is how an engine
  //     ends up decorating a lost race.
  //   Ahead by more than the bite  -> the plan cannot reach me, so CONVERT.
  //
  // The earlier version gated on "the rival is close to the line", which is
  // about how much a wall is worth to THEM and has nothing to do with whether it
  // matters to me. That is what let a four-step deficit in a race trigger a
  // defensive wall.
  const decisive = primary !== null && Math.abs(lead) <= primary.bite + 1;
  const urgent =
    !raceDecided &&
    primary !== null &&
    primary.bite > 0 &&
    decisive &&
    (primary.live || multiThreat || primary.structural);

  const counters: number[] = [];
  if (primary) {
    for (const wall of primary.walls.slice(0, 3)) counters.push(wall.packed);
  }

  const read: StrategicRead = {
    threats,
    primary,
    counters,
    multiThreat,
    urgent,
    raceDecided,
  };
  memoState = state;
  memoPlayerId = playerId;
  memoRead = read;
  return read;
}

/**
 * Has our wall removed the rival's plan?
 *
 * Precise on purpose. The first draft compared the rival's continuation cost
 * before and after our wall, which quietly credited any wall that happened to
 * shift the geometry — the plan was still intact, the numbers had just moved.
 * A plan is only broken when the slot they were going to play is no longer
 * available, or when the pair that compounded no longer compounds.
 *
 * Returns the fraction of the plan that survives, 0..1.
 */
export function planSurvives(
  before: StrategicRead,
  me: PlayerState,
  after: GameState
): number {
  const primary = before.primary;
  if (!primary || primary.bite <= 0) return 0;
  const board = boardOf(after);

  // The slots the plan is actually made of.
  const key = primary.structural
    ? primary.walls.filter((w) => w.pairDelay > 0)
    : primary.walls.slice(0, 1);
  const slots = key.length > 0 ? key : primary.walls.slice(0, 1);
  if (slots.length === 0) return 0;

  // Any of those slots now filled means that continuation is simply gone.
  for (const wall of slots) {
    if (slotConflicts(board.field.index, unpackSlot(wall.packed))) return 0;
  }

  // A compounding pair that has stopped compounding is broken even though both
  // walls are still playable. Re-measured on OUR board, which is one BFS.
  if (primary.structural && slots.length >= 2) {
    const a = distanceWith(board, me.goalDirection, me.position, [unpackSlot(slots[0].packed)]);
    const b = distanceWith(board, me.goalDirection, me.position, [unpackSlot(slots[1].packed)]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const pair = distanceWith(board, me.goalDirection, me.position, [
        unpackSlot(slots[0].packed),
        unpackSlot(slots[1].packed),
      ]);
      const sum = (a - baseDistance(board, me)) + (b - baseDistance(board, me));
      if (!Number.isFinite(pair) || pair - baseDistance(board, me) < sum * PAIR_SUPERADDITIVE) {
        return 0;
      }
    }
  }
  return 1;
}

function baseDistance(board: BoardStructure, me: PlayerState): number {
  const d = distanceWith(board, me.goalDirection, me.position, []);
  return Number.isFinite(d) ? d : 0;
}

/** Fraction of the primary plan this wall of ours destroys, 0..1. */
export function planSuppression(
  before: StrategicRead,
  me: PlayerState,
  after: GameState
): number {
  if (!before.primary || before.primary.bite <= 0) return 0;
  return (1 - planSurvives(before, me, after)) * before.primary.bite;
}

// ---------------------------------------------------------------------------
// Attack blueprint: MY funnel, priced the same way the rival's is
// ---------------------------------------------------------------------------

/**
 * My own funnel, priced the same way the rival's is — but composed deeper.
 *
 * The defensive layer above answers "what are they building against me". It
 * has no mirror: a wall of mine that delays the rival one step today and
 * anchors a three-step seal tomorrow is priced as a one-step wall, so it
 * loses every keep cut and every ranking to goal-line blocks with a bigger
 * immediate number. Every reverse-engineered exemplar is exactly such a
 * brick: individually +1, structurally the first wall of a funnel.
 *
 * A two-slot lookahead cannot see these: the best PAIR at the exemplar
 * positions is two goal-line delays (+2, additive, a dead end), while the
 * funnel's three bricks compound to +3 and its full cage seals outright. So
 * the blueprint composes pairs AND triples from a pool of delaying slots
 * plus route-adjacent slots (funnel bricks like side walls delay nothing
 * alone and never appear in a top-delay list), and prefers compounding
 * combinations over additive ones — superadditivity is the funnel signature,
 * exactly as on the defensive side.
 *
 * Only completable funnels count: a combination that leaves the rival with
 * no route at all can never be finished (the closing wall would be illegal),
 * so sealing combos are skipped, not priced.
 */
export interface AttackBlueprint {
  /** Nearest rival this funnel is being built against. */
  rivalId: string;
  /** My best next bricks, packed (two or three slots). */
  slots: number[];
  /** Steps the bricks cost the rival TOGETHER, not summed. */
  damage: number;
  /**
   * Per-brick best damage, parallel to `slots`: the strongest funnel EACH
   * brick belongs to. Credit and affordability are sized per brick from this,
   * never from the shared best — a brick riding along in a great funnel must
   * not earn the great funnel's pay (that overpays passengers and ties the
   * ranking to enumeration order instead of merit).
   */
  memberDamage: number[];
}

/** Sources for the composition pool: delaying slots plus structural ones. */
const COMBO_POOL_CAP = 20;
const COMBO_TOP_DELAY = 8;
const COMBO_ROUTE_CELLS = 4;
const COMBO_NEAR = 2;
/** Walls within this Chebyshev distance of the foe seed thickening bricks. */
const COMBO_WALL_NEAR = 4;
/** Structural extras beyond the classic delay-plus-route pool. */
const COMBO_STRUCTURAL_EXTRA = 4;
/** Skip triples once a pair is already decisive: diminishing returns. */
const COMBO_PAIR_DECIDES = 5;

const touchScratch = new Int32Array(8);

let memoAttackState: GameState | null = null;
let memoAttackMe: string | null = null;
let memoAttack: AttackBlueprint | null = null;

export function resetAttackMemo(): void {
  memoAttackState = null;
  memoAttackMe = null;
  memoAttack = null;
}

/**
 * My best two-to-three-brick continuation against the nearest rival, or null
 * when there is no funnel worth building: no walls left, no active rival, no
 * legal combination worth two steps together (single-delay logic already
 * prices those), or the race already won against a disarmed rival — ahead by
 * two steps with nothing left to deny, just convert. An armed rival always
 * keeps the blueprint alive: denying their counterplay is conversion.
 */
export function readAttackBlueprint(state: GameState, me: PlayerState): AttackBlueprint | null {
  if (state === memoAttackState && me.id === memoAttackMe) return memoAttack;
  const done = (value: AttackBlueprint | null): AttackBlueprint | null => {
    memoAttackState = state;
    memoAttackMe = me.id;
    memoAttack = value;
    return value;
  };
  if (state.status !== 'IN_PROGRESS' || me.status !== 'ACTIVE' || me.wallsRemaining <= 0) {
    return done(null);
  }
  const board = boardOf(state);
  const myRoute = routeOf(state, board, me);
  if (!myRoute.hasGoalAccess) return done(null);

  let foe: PlayerState | null = null;
  let foeDist = Infinity;
  for (const p of state.players) {
    if (p.id === me.id || p.status !== 'ACTIVE') continue;
    const r = routeOf(state, board, p);
    if (r.hasGoalAccess && r.distance < foeDist) {
      foeDist = r.distance;
      foe = p;
    }
  }
  if (!foe) return done(null);
  // Ahead by two or more steps against a disarmed rival: nothing left to
  // deny, just convert. An armed rival can still cage me, so denying their
  // counterplay with my own funnel stays on the table however far ahead.
  if (myRoute.distance - foeDist < -1 && foe.wallsRemaining <= 0) return done(null);

  const n = scanSlots(board, foe, foeDist, me.wallsRemaining > 0);
  if (n === 0) return done(null);

  // Composition pool: the classic delay-plus-route body, byte-for-byte the
  // old behavior (top delays in merit order, then route-band cells in route
  // order), plus a small structural tail — thickenings of nearby walls,
  // continuations, chains — relevance-ordered. The body preserves every
  // funnel the old pool ever found; the tail only ADDS (it cannot evict body
  // members, which is what an order-free relevance sort got wrong). Tail
  // relevance is transparent: measured delay counts double, route contact and
  // thickening contact two, other structural contact one; ties break toward
  // the victim, then packed-ascending — identical on every run.
  const pool: number[] = [];
  const seen = new Set<number>();
  const pushBody = (packed: number): void => {
    if (pool.length < COMBO_POOL_CAP - COMBO_STRUCTURAL_EXTRA && !seen.has(packed)) {
      seen.add(packed);
      pool.push(packed);
    }
  };
  for (let i = 0; i < Math.min(n, COMBO_TOP_DELAY); i++) pushBody(scanPacked[i]);
  const foeRoute = routeOf(state, board, foe);
  const band = foeRoute.nearCells.slice(0, COMBO_ROUTE_CELLS);
  for (const cell of band) {
    const count = packedSlotsTouchingCell(cell.row, cell.col, touchScratch);
    for (let i = 0; i < count; i++) pushBody(touchScratch[i]);
  }
  const structural = new Set<number>();
  for (const s of board.field.extensions) structural.add(packSlot(s));
  for (const key of board.field.turnExtensions) {
    const parts = key.split(',');
    if (parts.length !== 3) continue;
    structural.add(
      Number(parts[0]) * 16 + Number(parts[1]) * 2 + (parts[2] === 'V' ? 1 : 0)
    );
  }
  const thickenings = new Set<number>();
  for (const w of state.walls) {
    if (Math.abs(w.row - foe.position.row) > COMBO_WALL_NEAR || Math.abs(w.col - foe.position.col) > COMBO_WALL_NEAR) {
      continue;
    }
    if (w.orientation === 'H') {
      if (w.row > 0) thickenings.add((w.row - 1) * 16 + w.col * 2);
      if (w.row < 7) thickenings.add((w.row + 1) * 16 + w.col * 2);
    } else {
      if (w.col > 0) thickenings.add(w.row * 16 + (w.col - 1) * 2 + 1);
      if (w.col < 7) thickenings.add(w.row * 16 + (w.col + 1) * 2 + 1);
    }
  }
  const tail: number[] = [];
  const tailSeen = new Set<number>();
  const pushTail = (packed: number): void => {
    if (!seen.has(packed) && !tailSeen.has(packed)) {
      tailSeen.add(packed);
      tail.push(packed);
    }
  };
  for (const packed of structural) pushTail(packed);
  for (const packed of thickenings) pushTail(packed);
  for (const chain of board.field.chains) {
    for (const s of chain.slots) {
      if (Math.abs(s.row - foe.position.row) <= COMBO_NEAR && Math.abs(s.col - foe.position.col) <= COMBO_NEAR) {
        pushTail(packSlot(s));
      }
    }
  }
  const delayOf = (packed: number): number => {
    for (let i = 0; i < n; i++) {
      if (scanPacked[i] === packed) return scanDelay[i];
    }
    return 0;
  };
  const nearBand = (packed: number): boolean => {
    const row = Math.floor(packed / 16);
    const col = Math.floor(packed / 2) % 8;
    for (const cell of band) {
      if (Math.abs(cell.row - row) <= 1 && Math.abs(cell.col - col) <= 1) return true;
    }
    return false;
  };
  tail.sort((a, b) => {
    const relevance = (p: number): number =>
      2 * delayOf(p) +
      (nearBand(p) ? 2 : 0) +
      (thickenings.has(p) ? 2 : 0) +
      (structural.has(p) ? 1 : 0);
    const ra = relevance(a);
    const rb = relevance(b);
    if (rb !== ra) return rb - ra;
    const da = Math.max(
      Math.abs(Math.floor(a / 16) - foe.position.row),
      Math.abs((Math.floor(a / 2) % 8) - foe.position.col)
    );
    const db = Math.max(
      Math.abs(Math.floor(b / 16) - foe.position.row),
      Math.abs((Math.floor(b / 2) % 8) - foe.position.col)
    );
    return da !== db ? da - db : a - b;
  });
  for (let i = 0; i < Math.min(COMBO_STRUCTURAL_EXTRA, tail.length); i++) {
    pool.push(tail[i]);
  }
  const legal = pool.filter((packed) => isLegalWallPlacement(state, me.id, unpackSlot(packed)));
  if (legal.length < 2) return done(null);

  const halves = new Map<number, number>();
  const singleDamage = (packed: number): number => {
    const hit = halves.get(packed);
    if (hit !== undefined) return hit;
    const d = distanceWith(board, foe.goalDirection, foe.position, [unpackSlot(packed)]);
    const value = Number.isFinite(d) ? Math.max(0, d - foeDist) : 0;
    halves.set(packed, value);
    return value;
  };

  // Bricks that lengthen my own route are never funnel material, however much
  // they hurt the foe: the blueprint prices foe damage only, so without this
  // a brick that maims us both anchors phantom funnels (and spends attack
  // credit on self-harm). Genuine sacrifices still compete through the normal
  // wall logic; they just don't get the funnel fast-track.
  const myBase = myRoute.distance;
  const selfHarms = new Map<number, boolean>();
  const harmsMe = (packed: number): boolean => {
    const hit = selfHarms.get(packed);
    if (hit !== undefined) return hit;
    const d = distanceWith(board, me.goalDirection, me.position, [unpackSlot(packed)]);
    const harms = !Number.isFinite(d) || d > myBase;
    selfHarms.set(packed, harms);
    return harms;
  };

  let bestSlots: number[] = [];
  let bestDamage = 0;
  let bestScore = 0;
  // Every evaluated combination, for the union below. A few hundred small
  // entries per root: invisible next to the search, and no extra BFS (the
  // numbers are already computed).
  const evaluated: { slots: number[]; damage: number; score: number }[] = [];
  const consider = (slots: number[]): void => {
    for (const packed of slots) {
      if (harmsMe(packed)) return;
    }
    const extras = slots.map(unpackSlot);
    const combined = distanceWith(board, foe.goalDirection, foe.position, extras);
    if (!Number.isFinite(combined)) return;
    const damage = combined - foeDist;
    if (damage < 2) return;
    let sum = 0;
    for (const packed of slots) sum += singleDamage(packed);
    // Funnels only: the combination must compound beyond its halves. An
    // additive pile of individually-best delays (two goal-line nicks in the
    // opening) is priced correctly by single-delay logic already; crediting
    // it as a funnel is what turns quiet openings into wall spam. Real cages
    // are almost all side-bricks with tiny halves, so they pass easily.
    if (!(damage > sum * PAIR_SUPERADDITIVE)) return;
    const score = damage * 1.5;
    evaluated.push({ slots: slots.slice(), damage, score });
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestDamage = damage;
      bestSlots = slots.slice();
    }
  };
  // Local completion pre-pass: a delaying brick's best partner is almost
  // always adjacent (cages are contiguous — corners meet, lines continue),
  // but adjacency is exactly what pool sources miss (delay-0 side-bricks far
  // from routes, chains and existing walls). So for each top-delay anchor,
  // evaluate every free groove in Chebyshev-1 directly, bypassing the pool
  // lottery: pairs the general enumeration cannot form because a partner was
  // cut. Bounded (~8 anchors × ~12 grooves, one BFS each) with legality
  // checked only for structural winners; pairs both sides already pool
  // (the main loops cover those) are skipped, never re-scored.
  const legalSet = new Set<number>(legal);
  const anchors: WallCoord[] = [];
  for (let i = 0; i < n && anchors.length < 8; i++) {
    const slot = unpackSlot(scanPacked[i]);
    if (scanDelay[i] >= 1) anchors.push(slot);
  }
  for (const anchor of anchors) {
    const anchorPacked = packSlot(anchor);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        for (const orientation of ['H', 'V'] as const) {
          const partner: WallCoord = { row: anchor.row + dr, col: anchor.col + dc, orientation };
          if (partner.row < 0 || partner.row >= 8 || partner.col < 0 || partner.col >= 8) continue;
          const packed = packSlot(partner);
          if (legalSet.has(packed)) continue;
          if (slotConflicts(board.field.index, partner)) continue;
          if (doesWallConflict(partner, [anchor])) continue;
          const combined = distanceWith(board, foe.goalDirection, foe.position, [anchor, partner]);
          if (!Number.isFinite(combined) || combined - foeDist < 2) continue;
          // Structural gate before the expensive legality check, same bar as
          // consider(): additive nick-piles are priced by delay logic already.
          const halves = singleDamage(anchorPacked) + singleDamage(packed);
          if (!(combined - foeDist > halves * PAIR_SUPERADDITIVE)) continue;
          if (!isLegalWallPlacement(state, me.id, anchor) || !isLegalWallPlacement(state, me.id, partner)) {
            continue;
          }
          consider([anchorPacked, packed]);
        }
      }
    }
  }
  for (let i = 0; i < legal.length; i++) {
    for (let j = i + 1; j < legal.length; j++) consider([legal[i], legal[j]]);
  }
  if (bestDamage < COMBO_PAIR_DECIDES) {
    for (let i = 0; i < legal.length; i++) {
      for (let j = i + 1; j < legal.length; j++) {
        for (let k = j + 1; k < legal.length; k++) consider([legal[i], legal[j], legal[k]]);
      }
    }
  }
  if (bestSlots.length === 0) return done(null);
  // Union of near-optimal funnels, not just the argmax: when two cages both
  // build real damage, crediting only the winner lets enumeration order (not
  // merit) pick the move — the ranking, with search behind it, is the right
  // judge among credited bricks. Membership is funnel-grade damage at most a
  // step and a half off the best; members are ordered by their own best
  // damage so the keep-guarantee takes the strongest bricks first.
  const bar = Math.max(3, bestDamage - 1.5);
  const memberDamage = new Map<number, number>();
  for (const combo of evaluated) {
    if (combo.damage < bar) continue;
    for (const packed of combo.slots) {
      const prev = memberDamage.get(packed);
      if (prev === undefined || combo.damage > prev) memberDamage.set(packed, combo.damage);
    }
  }
  const union = [...memberDamage.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0] - b[0]))
    .slice(0, 6)
    .map(([packed]) => packed);
  // No funnel-grade field (best below 3): fall back to the argmax pair so
  // small early funnels keep their credit instead of losing it entirely.
  const slots = union.length > 0 ? union : bestSlots;
  const memberDamages = slots.map((packed) => memberDamage.get(packed) ?? bestDamage);
  return done({ rivalId: foe.id, slots, damage: bestDamage, memberDamage: memberDamages });
}

// ---------------------------------------------------------------------------
// Seal forecast: price the rival's intent, not just their last wall
// ---------------------------------------------------------------------------

/** How many of the rival's planned slots one forecast prices. Two, always. */
const SEAL_LOOKAHEAD_SLOTS = 2;
/** Cap on priced future damage, in steps. A forecast is a warning, not a loss. */
const SEAL_DAMAGE_CAP = 6;

export interface SealForecast {
  /** Rival whose plan this is, for diagnostics. */
  rivalId: string;
  /** Their planned slots against me, packed, best first (at most two). */
  slots: number[];
  /** Steps the plan costs me if they build it now. Capped, never negative. */
  damage: number;
}

/**
 * What the rival is about to build, measured exactly and once per root.
 *
 * Weaknesses 1, 2 and 4 together are one hole: the engine prices walls that
 * exist, never walls that are coming. A funnel costs nothing until its final
 * wall closes it — then it is +9 at once — and every plan-aware term in the
 * engine is gated on `urgent`, which dies the moment the race gap exceeds the
 * bite plus one. From that ply on, the forming seal is invisible.
 *
 * This is the term without that gate. It takes the primary threat's next two
 * slots — the structural pair when one compounded, otherwise the two best
 * singles — and measures what they cost me TOGETHER, with one BFS at the root.
 * No superadditivity requirement: two individually harmless walls that jointly
 * cost three steps are exactly the case the pair detector's threshold misses
 * and the replayed losses are made of.
 *
 * Returns null when there is nothing worth acting on: no plan, a decided race,
 * no walls on either side to build it with, or a forecast that measures zero.
 * Null means every caller skips its work, so quiet positions pay nothing.
 *
 * Evidence gate, and why it exists. The first version of this triggered on
 * geometry alone — any two slots that jointly delayed me — and in the opening
 * it priced phantoms: slots on my own start line the rival was never going to
 * play, handing my march free credit for "escaping" them. Geometry is not
 * intent. Intent is evidenced by a rival wall recently played on me
 * (`pressure`, retrospective and cheap) or by a structure already compounding
 * (`structural`). One of the two is required.
 */
export function forecastSeal(
  state: GameState,
  me: PlayerState,
  myDistance: number,
  plan: StrategicRead | null | undefined,
  pressure: number
): SealForecast | null {
  const primary = plan?.primary ?? null;
  if (!primary || primary.bite <= 0 || plan?.raceDecided === true) return null;
  if (pressure <= 0 && !primary.structural) return null;
  if (me.wallsRemaining <= 0 || primary.wallsLeft <= 0) return null;
  if (primary.walls.length === 0 || !Number.isFinite(myDistance)) return null;
  const pair = primary.structural
    ? primary.walls.filter((w) => w.pairDelay > 0).slice(0, SEAL_LOOKAHEAD_SLOTS)
    : [];
  const picked =
    pair.length >= SEAL_LOOKAHEAD_SLOTS
      ? pair
      : primary.walls.slice(0, SEAL_LOOKAHEAD_SLOTS);
  if (picked.length === 0) return null;
  const board = boardOf(state);
  const live = picked
    .map((w) => unpackSlot(w.packed))
    .filter((s) => !slotConflicts(board.field.index, s));
  if (live.length === 0) return null;
  const d = distanceWith(board, me.goalDirection, me.position, live);
  const damage = !Number.isFinite(d)
    ? SEAL_DAMAGE_CAP
    : Math.min(SEAL_DAMAGE_CAP, Math.max(0, d - myDistance));
  if (damage <= 0) return null;
  return { rivalId: primary.rivalId, slots: picked.map((w) => w.packed), damage };
}

/**
 * Steps the forecasted plan STILL costs me after one of my candidates,
 * measured from the position the candidate produces.
 *
 * The forecast's slots are re-measured, not re-detected: the same two slots,
 * priced against my new square and my new walls. A candidate that steals one
 * of those slots finds it conflicting and simply drops it; a candidate that
 * walks out of the lane finds both slots measuring less. Either way the
 * number falls, and the fall is the prevention credit — exact, not heuristic.
 *
 * Costs one projected BFS per candidate (three in the rare case the pair would
 * seal me outright, where it falls back to the worst single). The 128-slot
 * scan this replaces is what made the earlier fragility attempt three times
 * too slow: the expensive question ("what are they building") is asked once
 * per root, and each candidate only asks the cheap one ("does it still hurt
 * me here").
 */
export function planDamageAfter(
  board: BoardStructure,
  goal: PlayerState['goalDirection'],
  from: { row: number; col: number },
  base: number,
  slots: number[]
): number {
  const live = slots
    .map(unpackSlot)
    .filter((s) => !slotConflicts(board.field.index, s));
  if (live.length === 0) return 0;
  const combined = distanceWith(board, goal, from, live);
  if (Number.isFinite(combined)) return Math.max(0, combined - base);
  // The pair would seal this square outright. From here the singles are priced
  // individually instead — and a single that seals is ILLEGAL for the rival to
  // play, so it contributes nothing rather than infinity.
  let worst = 0;
  for (const slot of live) {
    const d = distanceWith(board, goal, from, [slot]);
    if (Number.isFinite(d)) worst = Math.max(worst, d - base);
  }
  return Math.max(0, worst);
}

/**
 * The worst single wall the rivals could play against me right now, in steps.
 *
 * This is the measure that matters and it is NOT the same as "how good is my
 * route". A position can be on a short path and still be one wall away from
 * losing three steps, and that is precisely how the replayed losses went: the
 * engine was on a fine-looking route, took one more step, and the step is what
 * turned a +1 vulnerability into a +3 one. Looking only at current distance
 * cannot see that, because the damage is caused by a move that has not happened
 * yet.
 *
 * Reuses the same one-BFS-per-slot scan as the threat search, so it costs the
 * same as a threat read and is exact rather than heuristic.
 */
export function maxIncomingDamage(state: GameState, me: PlayerState): number {
  const board = boardOf(state);
  const myRoute = routeOf(state, board, me);
  if (!myRoute.hasGoalAccess) return 0;
  const armed = state.players.some(
    (p) => p.id !== me.id && p.status === 'ACTIVE' && p.wallsRemaining > 0
  );
  if (!armed) return 0;
  const n = scanSlots(board, me, myRoute.distance, true);
  return n === 0 ? 0 : scanDelay[0];
}

/** Memoised per root position, keyed by the action being scored. */
let memoFragileState: GameState | null = null;
let memoFragileMe: string | null = null;
let memoFragileBase = 0;
const fragileCache = new Map<number, number>();

export function resetFragilityMemo(): void {
  memoFragileState = null;
  memoFragileMe = null;
  memoFragileBase = 0;
  fragileCache.clear();
}

/**
 * Fragility of the position produced by one of our root candidates, relative
 * to the position we are in now. Positive means the move left us more exposed
 * to a single well-placed wall; negative means it tucked us in.
 *
 * Cached per root action, because the same candidate list is re-ranked at every
 * depth of iterative deepening and the answer does not depend on depth.
 */
export function fragilityDelta(state: GameState, me: PlayerState, action: GameAction): number {
  if (state !== memoFragileState || me.id !== memoFragileMe) {
    memoFragileState = state;
    memoFragileMe = me.id;
    memoFragileBase = maxIncomingDamage(state, me);
    fragileCache.clear();
  }
  const key =
    action.type === 'MOVE'
      ? action.to.row * 16 + action.to.col
      : action.type === 'PLACE_WALL'
        ? 1000 + packSlot(action.wall)
        : -1;
  if (key < 0) return 0;
  const hit = fragileCache.get(key);
  if (hit !== undefined) return hit;
  const applied = applyAction(state, action);
  let value = 0;
  if (applied.success) {
    const after = applied.state.players.find((p) => p.id === me.id);
    if (after && after.status === 'ACTIVE') {
      value = maxIncomingDamage(applied.state, after) - memoFragileBase;
    } else {
      // Finishing removes us from the board entirely: nothing left to expose.
      value = -memoFragileBase;
    }
  }
  fragileCache.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// Counterfactual exchange: our action, then THEIR best reply
// ---------------------------------------------------------------------------

export interface ExchangeOutcome {
  /** Our route length after their best reply. */
  myDistance: number;
  /** Their route length after their best reply. */
  theirDistance: number;
  /** Their reply, for diagnostics. */
  reply: GameAction | null;
  /** True when the reply is a wall that continues a plan. */
  replyExtendsPlan: boolean;
}

function bestProgressAction(state: GameState, player: PlayerState): GameAction | null {
  const board = boardOf(state);
  const route = routeOf(state, board, player);
  if (!route.hasGoalAccess) return null;
  const step = route.firstSteps[0];
  if (!step) return null;
  const applied = applyAction(state, { type: 'MOVE', to: step });
  return applied.success ? { type: 'MOVE', to: step } : null;
}

/**
 * Play OUR action, then let the most dangerous rival answer as well as it can —
 * including continuing its plan — and report the resulting race.
 *
 * This is the counterfactual the whole strategic layer exists to make
 * expressible: "this wall is weak on its own, but it takes away the move they
 * were about to make". A depth-limited search cannot see that, because the
 * rival's wall is not in its move list; here it is, explicitly, and the answer
 * comes from the same BFS the rest of the engine trusts.
 *
 * Bounded and cheap: one action application, then at most `REPLY_CONTINUATIONS`
 * of the plan's OWN slots plus one progress move. The reply set comes from the
 * strategic read rather than a fresh scan — the first draft re-scanned the whole
 * lattice for every candidate, which cost 256 BFS each and made the turn three
 * times slower for an answer that was already known.
 */
const REPLY_CONTINUATIONS = 3;

export function exchangeOutcome(
  state: GameState,
  me: PlayerState,
  myAction: GameAction,
  plan: StrategicRead | null
): ExchangeOutcome {
  const neutral: ExchangeOutcome = {
    myDistance: Infinity,
    theirDistance: Infinity,
    reply: null,
    replyExtendsPlan: false,
  };
  const first = applyAction(state, myAction);
  if (!first.success) return neutral;
  const s1 = first.state;
  const meAfter = s1.players.find((p) => p.id === me.id);
  if (!meAfter) return neutral;
  if (s1.status === 'COMPLETED' || meAfter.status === 'FINISHED') {
    return { myDistance: 0, theirDistance: Infinity, reply: null, replyExtendsPlan: false };
  }
  const board1 = boardOf(s1);
  const myBase = distanceWith(board1, meAfter.goalDirection, meAfter.position, []);

  const rivals = s1.players
    .filter((p) => p.id !== me.id && p.status === 'ACTIVE')
    .map((p) => ({ player: p, route: routeOf(s1, board1, p) }))
    .filter((e) => e.route.hasGoalAccess)
    .sort((a, b) => a.route.distance - b.route.distance);
  if (rivals.length === 0) {
    return { myDistance: myBase, theirDistance: Infinity, reply: null, replyExtendsPlan: false };
  }
  const foe = rivals[0];

  const replies: { action: GameAction; extends: boolean }[] = [];
  if (foe.player.wallsRemaining > 0) {
    // The plan's slots, minus any our own wall has just taken.
    for (const threat of plan?.threats ?? []) {
      if (threat.rivalId !== foe.player.id) continue;
      for (const wall of threat.walls.slice(0, REPLY_CONTINUATIONS)) {
        const slot: WallCoord = unpackSlot(wall.packed);
        if (slotConflicts(board1.field.index, slot)) continue;
        replies.push({ action: { type: 'PLACE_WALL', wall: slot }, extends: true });
      }
      break;
    }
  }
  const advance = bestProgressAction(s1, foe.player);
  if (advance) replies.push({ action: advance, extends: false });

  let best: ExchangeOutcome = {
    myDistance: myBase,
    theirDistance: foe.route.distance,
    reply: null,
    replyExtendsPlan: false,
  };
  let bestLead = -Infinity;
  for (const reply of replies) {
    const applied = applyAction(s1, reply.action);
    if (!applied.success) continue;
    const s2 = applied.state;
    const board2 = boardOf(s2);
    const foeAfter = s2.players.find((p) => p.id === foe.player.id);
    const meAfter2 = s2.players.find((p) => p.id === me.id);
    if (!foeAfter || !meAfter2) continue;
    const theirDistance =
      s2.status === 'COMPLETED' || foeAfter.status === 'FINISHED'
        ? 0
        : distanceWith(board2, foeAfter.goalDirection, foeAfter.position, []);
    const myDistance =
      s2.status === 'COMPLETED' || meAfter2.status === 'FINISHED'
        ? 0
        : distanceWith(board2, meAfter2.goalDirection, meAfter2.position, []);
    // They maximise their own lead, which is the same as minimising mine.
    const lead =
      (Number.isFinite(theirDistance) ? theirDistance : 99) -
      (Number.isFinite(myDistance) ? myDistance : 99);
    if (lead > bestLead + 1e-9) {
      bestLead = lead;
      best = {
        myDistance: Number.isFinite(myDistance) ? myDistance : 99,
        theirDistance: Number.isFinite(theirDistance) ? theirDistance : 99,
        reply: reply.action,
        replyExtendsPlan: reply.extends,
      };
    }
  }
  return best;
}
