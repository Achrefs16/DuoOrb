/**
 * @deprecated Deprecated in favor of @duoorb/analyzer-rust and duoorb-ai-native pure-Rust AlphaZero ONNX engine.
 */
import type { CellCoord, GameAction, GameState, WallCoord } from './types.js';
import { getLegalMoves } from './movement.js';
import {
  doesWallIntersectPath,
  getShortestDistance,
  getShortestDistanceCached,
  getShortestPath,
} from './pathfinding.js';
import { isLegalWallPlacement } from './walls.js';
import { applyAction } from './ruleset.js';

/**
 * Pure heuristic MCTS (no neural network): UCT selection, heuristic
 * expansion, biased rollouts, max-n backup. One code path serves every
 * mode and player count ÔÇö multiplayer needs no special casing because
 * each node optimises only its own mover's outcome component.
 *
 * Intended as a sparring partner and measurement tool, not a replacement:
 * strength comes from simulation count, which is the caller's explicit
 * budget (there is no clock inside).
 */

export interface MctsOptions {
  /** Full simulations per move. Strength scales with this. */
  simulations?: number;
  /** UCT exploration constant (win-rate units). */
  uctConst?: number;
  /** Seed for full determinism; omit for nondeterministic play. */
  seed?: number;
  /** Rollout wall probability (rest: shortest-path step or backward move). */
  wallMoveProb?: number;
  /** Rollout length cap; hit means draw. */
  maxRolloutPlies?: number;
  /** Rollout probability of a targeted block on an opponent's next step. */
  blockMoveProb?: number;
  /** Wall-clock time budget in ms; if reached after minimal exploration, halts gracefully. */
  timeBudgetMs?: number;
  /** Lookahead steps along opponent shortest path for generating blocking walls. Defaults to 6. */
  wallHorizon?: number;
  [key: string]: unknown;
}

export interface MctsStats {
  simulations: number;
  nodes: number;
  elapsedMs: number;
  bestVisits: number;
  bestWinRate: number;
}

interface MctsNode {
  move: GameAction | null;
  parent: MctsNode | null;
  children: MctsNode[];
  state: GameState;
  moverIndex: number;
  visits: number;
  rewards: number[];
  terminalWinner: number | null; // player index, -1 = draw, null = open
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function winnerIndexOf(state: GameState): number | null {
  if (state.winnerId) {
    const idx = state.players.findIndex((p) => p.id === state.winnerId);
    if (idx >= 0) return idx;
  }
  const first = state.players.findIndex((p) => p.place === 1);
  if (first >= 0) return first;
  if (state.status === 'COMPLETED') return -1;
  return null;
}

/**
 * Tight wall candidate set: the four slots bordering my own pawn, plus the
 * path-crossing slots that most lengthen each active opponent's route.
 */
function findPathBlockingWalls(
  st: GameState,
  actorId: string,
  target: { position: { row: number; col: number }; goalDirection: GameState['players'][number]['goalDirection'] },
  horizon = 6
): { wall: WallCoord; delay: number }[] {
  const base = getShortestDistance(target.position, target.goalDirection, st.walls, st.mode);
  if (base === Infinity) return [];
  const path = getShortestPath(target.position, target.goalDirection, st.walls, st.mode);
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

  // 1. Touch slots
  const { row, col } = target.position;
  add({ row: row - 1, col, orientation: 'H' });
  add({ row, col, orientation: 'H' });
  add({ row, col: col - 1, orientation: 'V' });
  add({ row, col, orientation: 'V' });

  // 2. Path crossing slots (first 6 steps of opponent shortest path)
  if (path && path.length > 0) {
    let cur = target.position;
    const steps = Math.min(path.length, Math.max(2, horizon));
    for (let i = 0; i < steps; i++) {
      const next = path[i];
      if (next.row === cur.row + 1) {
        add({ row: cur.row, col: cur.col, orientation: 'H' });
        add({ row: cur.row, col: cur.col - 1, orientation: 'H' });
      } else if (next.row === cur.row - 1) {
        add({ row: next.row, col: cur.col, orientation: 'H' });
        add({ row: next.row, col: cur.col - 1, orientation: 'H' });
      } else if (next.col === cur.col + 1) {
        add({ row: cur.row, col: cur.col, orientation: 'V' });
        add({ row: cur.row - 1, col: cur.col, orientation: 'V' });
      } else if (next.col === cur.col - 1) {
        add({ row: cur.row, col: next.col, orientation: 'V' });
        add({ row: cur.row - 1, col: next.col, orientation: 'V' });
      }
      cur = next;
    }
  }

  const results: { wall: WallCoord; delay: number }[] = [];
  for (const slot of candidates) {
    if (!doesWallIntersectPath(path, slot)) continue;
    if (!isLegalWallPlacement(st, actorId, slot)) continue;
    const after = getShortestDistance(target.position, target.goalDirection, [...st.walls, slot], st.mode);
    if (after > base) {
      results.push({ wall: slot, delay: after - base });
    }
  }
  results.sort((a, b) => b.delay - a.delay);
  return results;
}/**
 * Evaluates whether a pawn step walks into an immediate adjacent dead-end corridor trap
 * (where an opponent can inflict a >= 4 step detour with an adjacent wall).
 */
function evaluatePawnStepDanger(
  st: GameState,
  moverId: string,
  to: CellCoord,
  horizon = 8
): { isPoisoned: boolean; maxDelay: number; lethalWall: WallCoord | null } {
  const mover = st.players.find((p) => p.id === moverId);
  if (!mover) return { isPoisoned: false, maxDelay: 0, lethalWall: null };

  const applied = applyAction(st, { type: 'MOVE', to });
  if (!applied.success) return { isPoisoned: false, maxDelay: 0, lethalWall: null };

  const moverAfter = applied.state.players.find((p) => p.id === moverId);
  if (!moverAfter) return { isPoisoned: false, maxDelay: 0, lethalWall: null };

  const baseDistAfterStep = getShortestDistance(
    moverAfter.position,
    moverAfter.goalDirection,
    applied.state.walls,
    applied.state.mode
  );
  if (baseDistAfterStep === 0) {
    return { isPoisoned: false, maxDelay: 0, lethalWall: null };
  }

  let maxDelay = 0;
  let lethalWall: WallCoord | null = null;

  for (const foe of applied.state.players) {
    if (foe.id === moverId || foe.status !== 'ACTIVE' || foe.wallsRemaining <= 0) continue;
    const blocks = findPathBlockingWalls(applied.state, foe.id, moverAfter, horizon);
    const foeBaseDist = getShortestDistance(foe.position, foe.goalDirection, applied.state.walls, applied.state.mode);
    for (const b of blocks) {
      // Must be physically adjacent to the pawn's new position to be an immediate trap
      const isAdjacent = Math.abs(b.wall.row - to.row) <= 1 && Math.abs(b.wall.col - to.col) <= 1;
      if (!isAdjacent) continue;

      const foeAfterDist = getShortestDistance(foe.position, foe.goalDirection, [...applied.state.walls, b.wall], applied.state.mode);
      const foeSelfDelay = Math.max(0, foeAfterDist - foeBaseDist);
      const netThreat = b.delay - foeSelfDelay;
      if (netThreat > maxDelay) {
        maxDelay = netThreat;
        lethalWall = b.wall;
      }
    }
  }

  // A true lethal corridor trap forces a severe backtrack detour (>= 4)
  const threshold = 4;
  return {
    isPoisoned: maxDelay >= threshold,
    maxDelay,
    lethalWall,
  };
}

function findBlockingWall(
  st: GameState,
  actorId: string,
  target: { position: { row: number; col: number }; goalDirection: GameState['players'][number]['goalDirection'] },
  horizon = 6
): WallCoord | null {
  const blocks = findPathBlockingWalls(st, actorId, target, horizon);
  return blocks.length > 0 ? blocks[0].wall : null;
}

function probableWalls(st: GameState, playerId: string, horizon = 6, _isEasy = false): WallCoord[] {
  const out = new Map<string, WallCoord>();
  const add = (slot: WallCoord): void => {
    if (slot.row < 0 || slot.row > 7 || slot.col < 0 || slot.col > 7) return;
    out.set(`${slot.row},${slot.col},${slot.orientation}`, slot);
  };

  // If ANY active rival is 1 step from their goal, survival is mandatory:
  // only consider walls that delay the critical rival!
  const criticalFoe = st.players.find(
    (p) =>
      p.id !== playerId &&
      p.status === 'ACTIVE' &&
      getShortestDistance(p.position, p.goalDirection, st.walls, st.mode) === 1
  );
  if (criticalFoe) {
    const blocks = findPathBlockingWalls(st, playerId, criticalFoe, horizon);
    for (const b of blocks) {
      if (b.delay >= 1) add(b.wall);
    }
    return [...out.values()];
  }

  const me = st.players.find((p) => p.id === playerId);
  const isOpening = st.walls.length <= 2 && (me ? getShortestDistance(me.position, me.goalDirection, st.walls, st.mode) >= 6 : false);

  // Generate candidate walls that STOP/DELAY active opponents.
  // Walls that do not delay an opponent (delay <= 0) are strictly pruned.
  for (const foe of st.players) {
    if (foe.id === playerId || foe.status !== 'ACTIVE') continue;
    const blocks = findPathBlockingWalls(st, playerId, foe, horizon);
    for (let i = 0; i < Math.min(10, blocks.length); i++) {
      if (blocks[i].delay <= 0) continue;
      if (isOpening && blocks[i].delay <= 2) continue;
      add(blocks[i].wall);
    }
  }
  return [...out.values()];
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let lastMctsStats: MctsStats = { simulations: 0, nodes: 0, elapsedMs: 0, bestVisits: 0, bestWinRate: 0 };

export function mctsStats(): MctsStats {
  return lastMctsStats;
}

interface MctsSession {
  simulations: number;
  immediateWinAction?: GameAction | null;
  stepSimulation: () => void;
  finalize: () => GameAction | null;
}

function createMctsSession(state: GameState, opts: MctsOptions = {}): MctsSession {
  const started = Date.now();
  const simulations = Math.max(1, Math.floor(opts.simulations ?? 1200));
  const uctConst = opts.uctConst ?? 0.5;
  const maxRollout = Math.max(1, Math.floor(opts.maxRolloutPlies ?? 6));
  const rng = mulberry32(opts.seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const playerCount = state.players.length;

  if (state.status !== 'IN_PROGRESS') {
    return {
      simulations: 0,
      immediateWinAction: null,
      stepSimulation: () => {},
      finalize: () => {
        lastMctsStats = { simulations: 0, nodes: 0, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
        return null;
      },
    };
  }
  const rootMover = state.players[state.currentPlayerIndex];
  if (!rootMover) {
    return {
      simulations: 0,
      immediateWinAction: null,
      stepSimulation: () => {},
      finalize: () => {
        lastMctsStats = { simulations: 0, nodes: 0, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
        return null;
      },
    };
  }

  // 1. Immediate Win: if any move wins the game right now, take it without simulating!
  const legalMoves = getLegalMoves(state, rootMover.id);
  for (const to of legalMoves) {
    const applied = applyAction(state, { type: 'MOVE', to });
    if (applied.success) {
      const moverAfter = applied.state.players.find((p) => p.id === rootMover.id);
      const winsNow =
        (applied.state.status === 'COMPLETED' && applied.state.winnerId === rootMover.id) ||
        (moverAfter !== undefined && moverAfter.place === 1);
      if (winsNow) {
        lastMctsStats = { simulations: 0, nodes: 1, elapsedMs: Date.now() - started, bestVisits: 1, bestWinRate: 1 };
        return {
          simulations: 0,
          immediateWinAction: { type: 'MOVE', to },
          stepSimulation: () => {},
          finalize: () => ({ type: 'MOVE', to }),
        };
      }
    }
  }

  // 2. Race lead check: leader should march rather than throw decorative walls
  const myDist = getShortestDistance(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
  let minFoeDist = Infinity;
  for (const foe of state.players) {
    if (foe.id !== rootMover.id && foe.status === 'ACTIVE') {
      const d = getShortestDistance(foe.position, foe.goalDirection, state.walls, state.mode);
      if (d < minFoeDist) minFoeDist = d;
    }
  }
  const hasCriticalFoe = minFoeDist === 1;
  const isRacing = state.mode.startsWith('race') || state.mode.startsWith('center');
  const isLeadingRace = myDist <= minFoeDist && minFoeDist > 1;
  const isCloseRace = isRacing && myDist <= minFoeDist + 1 && minFoeDist > 1;
  const isRacingFarBehind = minFoeDist > 1 && myDist >= minFoeDist + 3;
  const isHint = Boolean(opts.isHint);
  const isEasy = simulations < 200 || opts.difficulty === 'easy';
  const maxOpeningPly = state.players.length * 2;
  const isOpeningSprint = state.moveNumber <= maxOpeningPly && myDist >= 6 && minFoeDist >= 6;
  const shouldSprint = !isEasy && (isOpeningSprint || isLeadingRace || isCloseRace || isRacingFarBehind) && !hasCriticalFoe;
  const wallProb = shouldSprint ? 0.05 : (opts.wallMoveProb ?? (isHint ? 0.28 : (isEasy ? 0.12 : 0.28)));
  const blockProb = opts.blockMoveProb ?? (isHint ? 0.40 : (isEasy ? 0.20 : 0.35));
  const configuredHorizon = opts.wallHorizon ?? (isHint ? 16 : (isEasy ? 3 : 6));
  const effectiveHorizon = isOpeningSprint ? Math.min(configuredHorizon, 4) : configuredHorizon;
  const missDefenseProb = opts.missDefenseProb !== undefined
    ? Number(opts.missDefenseProb)
    : (isEasy ? 0.35 : 0);

  const newNode = (
    move: GameAction | null,
    parent: MctsNode | null,
    st: GameState
  ): MctsNode => ({
    move,
    parent,
    children: [],
    state: st,
    moverIndex: st.currentPlayerIndex,
    visits: 0,
    rewards: new Array<number>(playerCount).fill(0),
    terminalWinner: winnerIndexOf(st),
  });

  const uct = (node: MctsNode, parentVisits: number, selectorIndex: number): number => {
    if (node.visits === 0) return Infinity;
    const q = node.rewards[selectorIndex] / node.visits;
    return q + uctConst * Math.sqrt(Math.log(Math.max(1, parentVisits)) / node.visits);
  };

  const expand = (node: MctsNode): void => {
    const st = node.state;
    const mover = st.players[st.currentPlayerIndex];
    if (!mover) return;
    const moves: GameAction[] = [];
    const isRoot = node === root;
    const ignoreCritDefense = isRoot && !isHint && missDefenseProb > 0 && rng() < missDefenseProb;

    if (mover.wallsRemaining > 0 && !ignoreCritDefense) {
      const critFoe = st.players.find(
        (p) =>
          p.id !== mover.id &&
          p.status === 'ACTIVE' &&
          getShortestDistance(p.position, p.goalDirection, st.walls, st.mode) === 1
      );
      if (critFoe) {
        const blocks = findPathBlockingWalls(st, mover.id, critFoe, effectiveHorizon);
        for (const b of blocks) {
          moves.push({ type: 'PLACE_WALL' as const, wall: b.wall });
        }
      }
    }
    if (moves.length === 0) {
      const legal = getLegalMoves(st, mover.id);
      const curDist = getShortestDistance(mover.position, mover.goalDirection, st.walls, st.mode);
      const hasAdvancing = legal.some(
        (to) => getShortestDistance(to, mover.goalDirection, st.walls, st.mode) < curDist
      );
      const viableMoves = hasAdvancing
        ? legal.filter((to) => getShortestDistance(to, mover.goalDirection, st.walls, st.mode) <= curDist)
        : legal;
      moves.push(...viableMoves.map((to) => ({ type: 'MOVE' as const, to })));
      if (mover.wallsRemaining > 0) {
        for (const slot of probableWalls(st, mover.id, effectiveHorizon, isEasy)) {
          moves.push({ type: 'PLACE_WALL' as const, wall: slot });
        }
      }
    }
    shuffleInPlace(moves, rng);
    for (const action of moves) {
      const applied = applyAction(st, action);
      if (!applied.success) continue;
      node.children.push(newNode(action, node, applied.state));
    }
  };

  const outcomeOf = (winner: number | null): number[] => {
    const out = new Array<number>(playerCount).fill(0);
    if (winner === null || winner < 0) {
      out.fill(0.5);
    } else if (winner >= 0 && winner < playerCount) {
      out[winner] = 1;
    }
    return out;
  };

  const stateOutcome = (s: GameState): number[] => {
    const term = winnerIndexOf(s);
    if (term !== null) return outcomeOf(term);

    const activePlayers = s.players.filter((p) => p.status === 'ACTIVE');
    const avgWalls = activePlayers.length > 0
      ? activePlayers.reduce((acc, p) => acc + p.wallsRemaining, 0) / activePlayers.length
      : 0;

    const effDists = s.players.map((p) => {
      if (p.status !== 'ACTIVE') return Infinity;
      const d = getShortestDistance(p.position, p.goalDirection, s.walls, s.mode);
      if (!Number.isFinite(d)) return Infinity;
      const wallAdv = (p.wallsRemaining - avgWalls) * 1.2;
      return Math.max(0, d - wallAdv);
    });

    let bestDist = Infinity;
    for (const d of effDists) {
      if (d < bestDist) bestDist = d;
    }
    if (!Number.isFinite(bestDist)) return outcomeOf(-1);
    const out = new Array<number>(playerCount).fill(0);
    let sum = 0;
    for (let i = 0; i < playerCount; i++) {
      const d = effDists[i];
      if (!Number.isFinite(d)) {
        out[i] = 0;
      } else {
        const val = Math.exp(-0.4 * (d - bestDist));
        out[i] = val;
        sum += val;
      }
    }
    if (sum > 0) {
      for (let i = 0; i < playerCount; i++) out[i] /= sum;
    } else {
      out.fill(1 / playerCount);
    }
    return out;
  };

  const rollout = (st0: GameState): number[] => {
    let st = st0;
    for (let ply = 0; ply < maxRollout; ply++) {
      const term = winnerIndexOf(st);
      if (term !== null) return outcomeOf(term);
      const mover = st.players[st.currentPlayerIndex];
      if (!mover) break;
      let action: GameAction | null = null;
      // 1. Immediate win check in rollout: if mover is 1 step from goal, step in!
      if (getShortestDistance(mover.position, mover.goalDirection, st.walls, st.mode) === 1) {
        const path = getShortestPath(mover.position, mover.goalDirection, st.walls, st.mode);
        if (path && path.length > 1) {
          action = { type: 'MOVE', to: { ...path[1] } };
        }
      }
      // 2. Critical defense in rollout: if a foe is 1 step from goal and mover has walls, block!
      if (!action && mover.wallsRemaining > 0) {
        const crit = st.players.find(
          (p) =>
            p.id !== mover.id &&
            p.status === 'ACTIVE' &&
            getShortestDistance(p.position, p.goalDirection, st.walls, st.mode) === 1
        );
        if (crit) {
          const slot = findBlockingWall(st, mover.id, crit, effectiveHorizon);
          if (slot) action = { type: 'PLACE_WALL', wall: slot };
        }
      }
      const r = rng();
      if (!action && r < 1 - wallProb) {
        // March along a shortest path.
        const path = getShortestPath(mover.position, mover.goalDirection, st.walls, st.mode);
        if (path && path.length > 1) {
          action = { type: 'MOVE', to: { ...path[1] } };
        }
      }
      if (!action && mover.wallsRemaining > 0) {
        // Prefer cutting a real opponent's route over a decorative wall.
        if (rng() < blockProb) {
          const foes = st.players.filter((p) => p.id !== mover.id && p.status === 'ACTIVE');
          for (let i = foes.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [foes[i], foes[j]] = [foes[j], foes[i]];
          }
          for (const foe of foes) {
            const slot = findBlockingWall(st, mover.id, foe, effectiveHorizon);
            if (slot) {
              action = { type: 'PLACE_WALL', wall: slot };
              break;
            }
          }
        }
      }
      if (!action && mover.wallsRemaining > 0) {
        const walls = probableWalls(st, mover.id, effectiveHorizon, isEasy);
        if (walls.length > 0 && rng() < 0.5) {
          const slot = walls[Math.floor(rng() * walls.length)];
          action = { type: 'PLACE_WALL', wall: slot };
        }
      }
      if (!action) {
        const legal = getLegalMoves(st, mover.id);
        if (legal.length === 0) break;
        const curDist = getShortestDistance(mover.position, mover.goalDirection, st.walls, st.mode);
        const advancing = legal.filter(
          (to) => getShortestDistance(to, mover.goalDirection, st.walls, st.mode) <= curDist
        );
        const pool = advancing.length > 0 ? advancing : legal;
        const to = pool[Math.floor(rng() * pool.length)];
        action = { type: 'MOVE', to: { ...to } };
      }
      const applied = applyAction(st, action);
      if (!applied.success) {
        return stateOutcome(st);
      }
      st = applied.state;
    }
    return stateOutcome(st);
  };

  const root: MctsNode = newNode(null, null, state);
  expand(root);
  let nodeCount = 1 + root.children.length;

  const stepSimulation = (): void => {
    // Selection: descend UCT-best while fully expanded.
    let node = root;
    const path: MctsNode[] = [root];
    while (node.children.length > 0 && node.terminalWinner === null) {
      let best: MctsNode | null = null;
      let bestUct = -Infinity;
      const selectorIndex = node.state.currentPlayerIndex;
      for (const child of node.children) {
        const u = uct(child, node.visits, selectorIndex);
        if (u > bestUct) {
          bestUct = u;
          best = child;
        }
      }
      if (!best) break;
      node = best;
      path.push(node);
    }
    let outcome: number[];
    if (node.terminalWinner !== null) {
      outcome = outcomeOf(node.terminalWinner);
    } else if (node.visits === 0) {
      // Direct leaf evaluation on first visit
      outcome = rollout(node.state);
    } else {
      if (node.children.length === 0) {
        expand(node);
        nodeCount += node.children.length;
      }
      if (node.children.length > 0) {
        const child = node.children[Math.floor(rng() * node.children.length)];
        path.push(child);
        outcome = rollout(child.state);
      } else {
        outcome = rollout(node.state);
      }
    }
    for (const n of path) {
      n.visits++;
      for (let i = 0; i < playerCount; i++) n.rewards[i] += outcome[i];
    }
  };

  const finalize = (): GameAction | null => {
    if (root.children.length === 0) {
      const legal = getLegalMoves(state, rootMover.id);
      if (legal.length > 0) {
        lastMctsStats = { simulations, nodes: nodeCount, elapsedMs: Date.now() - started, bestVisits: 1, bestWinRate: 0.5 };
        return { type: 'MOVE', to: legal[0] };
      }
      lastMctsStats = { simulations, nodes: nodeCount, elapsedMs: Date.now() - started, bestVisits: 0, bestWinRate: 0 };
      return null;
    }
    let best = root.children[0];
    for (const child of root.children) {
      if (child.visits > best.visits) best = child;
    }

    // Conversion beats decoration: if leading the race or racing far behind, favor pawn advance
    // if an advance candidate is close in visits/win-rate
    if (shouldSprint) {
      const currentDist = getShortestDistance(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
      const moveChildren = root.children
        .filter((c) => c.move?.type === 'MOVE')
        .map((c) => {
          const to = (c.move as { type: 'MOVE'; to: CellCoord }).to;
          const dist = getShortestDistance(to, rootMover.goalDirection, state.walls, state.mode);
          return { child: c, dist };
        })
        .filter((entry) => entry.dist < currentDist)
        .sort((a, b) => a.dist - b.dist);

      for (const { child } of moveChildren) {
        if (child.visits >= best.visits * 0.25) {
          const childRate = child.visits > 0 ? child.rewards[rootMover.index] / child.visits : 0;
          const bestRate = best.visits > 0 ? best.rewards[rootMover.index] / best.visits : 0;
          if (childRate >= bestRate - 0.15) {
            best = child;
            break;
          }
        }
      }
    }

    const bestRate = best.visits > 0 ? best.rewards[rootMover.index] / best.visits : 0;

    // Candidate Selection Strategy:
    // 1. Easy bots: wider deltaQ, lower visit threshold, and blunderRate allowing
    //    human-like suboptimal 2nd/3rd choices without freezing or looping.
    // 2. Normal & Hard bots: strictly enforce Near-Optimal Candidate Selection with tight Delta-Q protection.
    if (!isHint && !shouldSprint && opts.randomness !== 0 && root.children.length > 1) {
      const isHard = simulations >= 2500 || opts.difficulty === 'hard';
      const isNormal = simulations >= 300 || opts.difficulty === 'normal';
      const deltaQ = opts.varietyWindow !== undefined
        ? Number(opts.varietyWindow)
        : (isHard ? 0.025 : (isNormal ? 0.065 : 0.25));
      const minVisitRatio = isHard ? 0.35 : (isNormal ? 0.20 : 0.02);
      const exponent = isHard ? 1.8 : (isNormal ? 1.3 : 0.9);
      const maxChoices = isHard ? 3 : (isNormal ? 3 : 4);

      const sorted = [...root.children].sort((a, b) => b.visits - a.visits);
      const myDist = getShortestDistance(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
      const hasForwardMove = sorted.some((c) => {
        const m = c.move;
        return m && m.type === 'MOVE' && getShortestDistance(m.to, rootMover.goalDirection, state.walls, state.mode) < myDist;
      });
      const candidatePool = hasForwardMove && !isEasy
        ? sorted.filter((c) => {
            const m = c.move;
            if (m && m.type === 'MOVE') {
              return getShortestDistance(m.to, rootMover.goalDirection, state.walls, state.mode) < myDist;
            }
            return true;
          })
        : sorted;
      const effectivePool = candidatePool.length > 0 ? candidatePool : sorted;

      const safeCandidates = effectivePool.slice(0, maxChoices).filter((c) => {
        const cRate = c.visits > 0 ? c.rewards[rootMover.index] / c.visits : 0;
        return cRate >= bestRate - deltaQ && c.visits >= best.visits * minVisitRatio;
      });

      const blunderRate = isEasy ? (opts.blunderRate !== undefined ? Number(opts.blunderRate) : 0.30) : 0;

      if (safeCandidates.length > 1) {
        if (blunderRate > 0 && rng() < blunderRate) {
          // Blunder: pick a suboptimal candidate (2nd, 3rd) but avoid backward pawn moves if forward is open
          const sensibleSub = safeCandidates.slice(1).filter((c) => {
            const m = c.move;
            if (m && m.type === 'MOVE') {
              const d = getShortestDistance(m.to, rootMover.goalDirection, state.walls, state.mode);
              return d <= myDist;
            }
            return true;
          });
          const pool = sensibleSub.length > 0 ? sensibleSub : safeCandidates.slice(1);
          best = pool[Math.floor(rng() * pool.length)];
        } else {
          const weights = safeCandidates.map((c) => Math.pow(c.visits / best.visits, exponent));
          const totalWeight = weights.reduce((acc, w) => acc + w, 0);
          let pick = rng() * totalWeight;
          for (let i = 0; i < safeCandidates.length; i++) {
            if (pick <= weights[i]) {
              best = safeCandidates[i];
              break;
            }
            pick -= weights[i];
          }
        }
      }
    }

    lastMctsStats = {
      simulations,
      nodes: nodeCount,
      elapsedMs: Date.now() - started,
      bestVisits: best.visits,
      bestWinRate: best.visits > 0 ? best.rewards[rootMover.index] / best.visits : bestRate,
    };

    // Forward-progress guarantee in losing positions:
    // If collapsing (bestRate < 0.20 or trailing far behind in an unstoppable race) and chosen move either
    // steps backward/sideways, or places an unhelpful wall, or we have 0 walls left:
    // march forward along the best advancing move towards the goal!
    const isCollapsing = bestRate < 0.20 || (minFoeDist <= 3 && myDist >= minFoeDist + 2);
    if (isCollapsing) {
      const myDist = getShortestDistance(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
      const bm = best.move;
      const isBackwardOrStationary = Boolean(
        bm &&
        bm.type === 'MOVE' &&
        getShortestDistance(bm.to, rootMover.goalDirection, state.walls, state.mode) >= myDist
      );

      let isProductiveWall = false;
      if (bm?.type === 'PLACE_WALL') {
        const applied = applyAction(state, bm);
        if (applied.success) {
          const foeDistsAfter = applied.state.players
            .filter((p) => p.id !== rootMover.id && p.status === 'ACTIVE')
            .map((p) => getShortestDistance(p.position, p.goalDirection, applied.state.walls, applied.state.mode));
          const minFoeAfter = Math.min(...foeDistsAfter);
          if (minFoeAfter > minFoeDist) {
            isProductiveWall = true;
          }
        }
      }

      if (isBackwardOrStationary || (!isProductiveWall && bm?.type === 'PLACE_WALL') || rootMover.wallsRemaining === 0) {
        const legal = getLegalMoves(state, rootMover.id);
        let bestAdvancing: CellCoord | null = null;
        let minAdvDist = myDist;
        for (const cand of legal) {
          const d = getShortestDistance(cand, rootMover.goalDirection, state.walls, state.mode);
          if (d < minAdvDist) {
            minAdvDist = d;
            bestAdvancing = cand;
          }
        }
        if (bestAdvancing) {
          lastMctsStats.elapsedMs = Date.now() - started;
          return { type: 'MOVE', to: { ...bestAdvancing } };
        }
      }
    }

    // Tactical Refutation Guard:
    // If the chosen move is a pawn step that walks into an immediate adjacent dead-end trap (>= 4 delay),
    // refute it by selecting a safe alternative pawn step (e.g. open flank or safe bypass).
    // Never force-place a zero-delay self-wall or cross-cut wall!
    if (!isEasy && best.move?.type === 'MOVE') {
      const stepTo = best.move.to;
      const danger = evaluatePawnStepDanger(state, rootMover.id, stepTo, effectiveHorizon);
      if (danger.isPoisoned && danger.lethalWall) {
        let bestCounterAction: GameAction | null = null;
        let bestCounterScore = -Infinity;

        // Search explored root children for a safe alternative pawn move
        for (const child of root.children) {
          if (!child.move || child.move.type !== 'MOVE') continue;
          const altTo = child.move.to;
          if (altTo.row !== stepTo.row || altTo.col !== stepTo.col) {
            const stepDist = getShortestDistance(stepTo, rootMover.goalDirection, state.walls, state.mode);
            const altDist = getShortestDistance(altTo, rootMover.goalDirection, state.walls, state.mode);
            if (altDist <= stepDist + 1) {
              const altDanger = evaluatePawnStepDanger(state, rootMover.id, altTo, effectiveHorizon);
              if (!altDanger.isPoisoned) {
                const childRate = child.visits > 0 ? child.rewards[rootMover.index] / child.visits : 0.5;
                if (childRate > bestCounterScore) {
                  bestCounterScore = childRate;
                  bestCounterAction = child.move;
                }
              }
            }
          }
        }

        if (bestCounterAction) {
          lastMctsStats.elapsedMs = Date.now() - started;
          return bestCounterAction;
        }
      }
    }

    return best.move;
  };

  return { simulations, stepSimulation, finalize };
}

export function mctsBestAction(state: GameState, opts: MctsOptions = {}): GameAction | null {
  const session = createMctsSession(state, opts);
  if (session.immediateWinAction !== undefined) return session.immediateWinAction;
  const simDeadline = opts.timeBudgetMs ? Date.now() + Math.max(10, Math.floor(opts.timeBudgetMs * 0.72)) : Infinity;
  for (let sim = 0; sim < session.simulations; sim++) {
    if (sim > 4 && (sim & 3) === 0 && Date.now() >= simDeadline) {
      break;
    }
    session.stepSimulation();
  }
  return session.finalize();
}

export async function mctsBestActionAsync(
  state: GameState,
  opts: MctsOptions = {},
  hooks?: { shouldCancel?: () => boolean }
): Promise<GameAction | null> {
  const session = createMctsSession(state, opts);
  if (session.immediateWinAction !== undefined) return session.immediateWinAction;
  const simDeadline = opts.timeBudgetMs ? Date.now() + Math.max(10, Math.floor(opts.timeBudgetMs * 0.72)) : Infinity;
  const CHUNK_SIZE = 100;
  for (let sim = 0; sim < session.simulations; sim += CHUNK_SIZE) {
    if (hooks?.shouldCancel?.()) return null;
    const end = Math.min(session.simulations, sim + CHUNK_SIZE);
    for (let i = sim; i < end; i++) {
      session.stepSimulation();
    }
    if (Date.now() >= simDeadline) break;
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return session.finalize();
}
