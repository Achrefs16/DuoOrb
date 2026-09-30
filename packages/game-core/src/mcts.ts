import type { GameAction, GameState, WallCoord } from './types.js';
import { getLegalMoves } from './movement.js';
import { getShortestDistance, getShortestPath } from './pathfinding.js';
import { isLegalWallPlacement } from './walls.js';
import { applyAction } from './ruleset.js';

/**
 * Pure heuristic MCTS (no neural network): UCT selection, heuristic
 * expansion, biased rollouts, max-n backup. One code path serves every
 * mode and player count — multiplayer needs no special casing because
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
  if (state.status !== 'COMPLETED') return null;
  if (!state.winnerId) return -1;
  const idx = state.players.findIndex((p) => p.id === state.winnerId);
  return idx >= 0 ? idx : -1;
}

/**
 * Tight wall candidate set: the four slots bordering my own pawn, plus the
 * single slot that most lengthens each active opponent's route. A radius-2
 * sweep looks reasonable but produces ~200 root children, which starves
 * every child of visits and turns the "search" into a lottery. ~12 children
 * buys real depth at the same simulation count.
 */
function probableWalls(st: GameState, playerId: string): WallCoord[] {
  const out = new Map<string, WallCoord>();
  const me = st.players.find((p) => p.id === playerId);
  const add = (slot: WallCoord): void => {
    if (slot.row < 0 || slot.row > 7 || slot.col < 0 || slot.col > 7) return;
    out.set(`${slot.row},${slot.col},${slot.orientation}`, slot);
  };
  const bordering = (row: number, col: number): WallCoord[] => [
    { row: row - 1, col, orientation: 'H' },
    { row, col, orientation: 'H' },
    { row, col: col - 1, orientation: 'V' },
    { row, col, orientation: 'V' },
  ];
  if (me) {
    for (const slot of bordering(me.position.row, me.position.col)) {
      if (isLegalWallPlacement(st, playerId, slot)) add(slot);
    }
  }
  for (const foe of st.players) {
    if (foe.id === playerId || foe.status !== 'ACTIVE') continue;
    const block = findBlockingWall(st, playerId, foe);
    if (block) add(block);
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

/**
 * Best wall among the four slots touching `target`'s pawn, judged by how much
 * it lengthens that pawn's shortest path. Without this, rollouts only ever
 * wander with walls at random and the search never sees that placement can
 * matter — which is the single biggest reason naive MCTS loses to alpha-beta
 * in Quoridor. Convention-agnostic: no assumptions about H/V semantics.
 */
function findBlockingWall(
  st: GameState,
  actorId: string,
  target: { position: { row: number; col: number }; goalDirection: GameState['players'][number]['goalDirection'] }
): WallCoord | null {
  const base = getShortestDistance(target.position, target.goalDirection, st.walls, st.mode);
  if (base === Infinity) return null;
  const { row, col } = target.position;
  const candidates: WallCoord[] = [
    { row: row - 1, col, orientation: 'H' },
    { row, col, orientation: 'H' },
    { row, col: col - 1, orientation: 'V' },
    { row, col, orientation: 'V' },
  ];
  let best: WallCoord | null = null;
  let bestDist = base;
  for (const slot of candidates) {
    if (slot.row < 0 || slot.row > 7 || slot.col < 0 || slot.col > 7) continue;
    if (!isLegalWallPlacement(st, actorId, slot)) continue;
    const after = getShortestDistance(target.position, target.goalDirection, [...st.walls, slot], st.mode);
    if (after > bestDist) {
      bestDist = after;
      best = slot;
    }
  }
  return best;
}

let lastMctsStats: MctsStats = { simulations: 0, nodes: 0, elapsedMs: 0, bestVisits: 0, bestWinRate: 0 };

export function mctsStats(): MctsStats {
  return lastMctsStats;
}

export function mctsBestAction(state: GameState, opts: MctsOptions = {}): GameAction | null {
  const started = Date.now();
  const simulations = Math.max(1, Math.floor(opts.simulations ?? 5000));
  const uctConst = opts.uctConst ?? 0.5;
  const wallProb = opts.wallMoveProb ?? 0.3;
  const blockProb = opts.blockMoveProb ?? 0.35;
  const maxRollout = Math.max(1, Math.floor(opts.maxRolloutPlies ?? 200));
  const rng = mulberry32(opts.seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0));
  const playerCount = state.players.length;

  const finish = (action: GameAction | null): GameAction | null => {
    lastMctsStats.elapsedMs = Date.now() - started;
    return action;
  };
  if (state.status !== 'IN_PROGRESS') return finish(null);
  const rootMover = state.players[state.currentPlayerIndex];
  if (!rootMover) return finish(null);

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

  const uct = (node: MctsNode, parentVisits: number): number => {
    if (node.visits === 0) return Infinity;
    const q = node.rewards[node.moverIndex] / node.visits;
    return q + uctConst * Math.sqrt(Math.log(Math.max(1, parentVisits)) / node.visits);
  };

  const expand = (node: MctsNode): void => {
    const st = node.state;
    const mover = st.players[st.currentPlayerIndex];
    if (!mover) return;
    const moves: GameAction[] = getLegalMoves(st, mover.id).map((to) => ({ type: 'MOVE' as const, to }));
    if (mover.wallsRemaining > 0) {
      for (const slot of probableWalls(st, mover.id)) {
        moves.push({ type: 'PLACE_WALL' as const, wall: slot });
      }
    }
    shuffleInPlace(moves, rng);
    for (const action of moves) {
      const applied = applyAction(st, action);
      if (!applied.success) continue;
      node.children.push(newNode(action, node, applied.state));
    }
  };

  const rollout = (st0: GameState): number[] => {
    let st = st0;
    for (let ply = 0; ply < maxRollout; ply++) {
      const term = winnerIndexOf(st);
      if (term !== null) return outcomeOf(term);
      const mover = st.players[st.currentPlayerIndex];
      if (!mover) break;
      const r = rng();
      let action: GameAction | null = null;
      if (r < 1 - wallProb) {
        // March along a shortest path.
        const path = getShortestPath(mover.position, mover.goalDirection, st.walls, st.mode);
        if (path && path.length > 0) {
          action = { type: 'MOVE', to: { ...path[0] } };
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
            const slot = findBlockingWall(st, mover.id, foe);
            if (slot) {
              action = { type: 'PLACE_WALL', wall: slot };
              break;
            }
          }
        }
      }
      if (!action && mover.wallsRemaining > 0) {
        const walls = probableWalls(st, mover.id);
        if (walls.length > 0 && rng() < 0.5) {
          const slot = walls[Math.floor(rng() * walls.length)];
          action = { type: 'PLACE_WALL', wall: slot };
        }
      }
      if (!action) {
        // Backward/sideways drift: any legal move, preferring non-progress
        // so rollouts do not all funnel down the same corridor.
        const legal = getLegalMoves(st, mover.id);
        if (legal.length === 0) break;
        const to = legal[Math.floor(rng() * legal.length)];
        action = { type: 'MOVE', to: { ...to } };
      }
      const applied = applyAction(st, action);
      if (!applied.success) {
        // Defensive: a candidate that fails validation ends the rollout as
        // a draw rather than crashing the search.
        return outcomeOf(-1);
      }
      st = applied.state;
    }
    return outcomeOf(-1);
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

  const root: MctsNode = newNode(null, null, state);
  let nodeCount = 1;

  for (let sim = 0; sim < simulations; sim++) {
    // Selection: descend UCT-best while fully expanded.
    let node = root;
    const path: MctsNode[] = [root];
    while (node.children.length > 0 && node.terminalWinner === null) {
      let best: MctsNode | null = null;
      let bestUct = -Infinity;
      for (const child of node.children) {
        const u = uct(child, node.visits);
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
    } else {
      if (node.visits > 0 || node === root) {
        expand(node);
        nodeCount += node.children.length;
      }
      if (node.children.length === 0) {
        outcome = outcomeOf(node.terminalWinner);
      } else {
        const child = node.children[Math.floor(rng() * node.children.length)];
        path.push(child);
        outcome = rollout(child.state);
      }
    }
    for (const n of path) {
      n.visits++;
      for (let i = 0; i < playerCount; i++) n.rewards[i] += outcome[i];
    }
  }

  if (root.children.length === 0) return finish(null);
  let best = root.children[0];
  for (const child of root.children) {
    if (child.visits > best.visits) best = child;
  }
  const bestRate = best.visits > 0 ? best.rewards[rootMover.index] / best.visits : 0;
  lastMctsStats = {
    simulations,
    nodes: nodeCount,
    elapsedMs: Date.now() - started,
    bestVisits: best.visits,
    bestWinRate: bestRate,
  };

  // Losing-rescue: a collapsing position marches instead of decorating.
  if (bestRate < 0.1) {
    const path = getShortestPath(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
    if (path && path.length > 0) {
      const to = path[0];
      if (getLegalMoves(state, rootMover.id).some((c) => c.row === to.row && c.col === to.col)) {
        lastMctsStats.elapsedMs = Date.now() - started;
        return { type: 'MOVE', to: { ...to } };
      }
    }
  }
  lastMctsStats.elapsedMs = Date.now() - started;
  return best.move;
}
