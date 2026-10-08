import type { CellCoord, GameAction, GameState, WallCoord } from './types.js';
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
  /** Wall-clock time budget in ms; if reached after minimal exploration, halts gracefully. */
  timeBudgetMs?: number;
  /** Lookahead steps along opponent shortest path for generating blocking walls. Defaults to 6. */
  wallHorizon?: number;
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
    if (!isLegalWallPlacement(st, actorId, slot)) continue;
    const after = getShortestDistance(target.position, target.goalDirection, [...st.walls, slot], st.mode);
    if (after > base) {
      results.push({ wall: slot, delay: after - base });
    }
  }
  results.sort((a, b) => b.delay - a.delay);
  return results;
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

function probableWalls(st: GameState, playerId: string, horizon = 6): WallCoord[] {
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
      add(b.wall);
    }
    return [...out.values()];
  }

  const me = st.players.find((p) => p.id === playerId);
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
    const blocks = findPathBlockingWalls(st, playerId, foe, horizon);
    for (let i = 0; i < Math.min(6, blocks.length); i++) {
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
  const maxRollout = Math.max(1, Math.floor(opts.maxRolloutPlies ?? 14));
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
  const isRacingFarBehind = isRacing && minFoeDist > 1 && myDist >= minFoeDist + 3;
  const shouldSprint = (isLeadingRace || isCloseRace || isRacingFarBehind) && !hasCriticalFoe;
  const wallProb = shouldSprint ? 0.05 : (opts.wallMoveProb ?? 0.3);
  const blockProb = opts.blockMoveProb ?? 0.35;
  const configuredHorizon = opts.wallHorizon ?? 6;
  const maxOpeningPly = state.players.length * 2;
  const isOpeningSprint = state.moveNumber <= maxOpeningPly && myDist >= 7 && minFoeDist >= 7;
  const effectiveHorizon = isOpeningSprint ? Math.min(configuredHorizon, 4) : configuredHorizon;

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
    if (mover.wallsRemaining > 0) {
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
      moves.push(...getLegalMoves(st, mover.id).map((to) => ({ type: 'MOVE' as const, to })));
      if (mover.wallsRemaining > 0) {
        for (const slot of probableWalls(st, mover.id, effectiveHorizon)) {
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
    const dists = s.players.map((p) =>
      p.status === 'ACTIVE'
        ? getShortestDistance(p.position, p.goalDirection, s.walls, s.mode)
        : Infinity
    );
    let bestDist = Infinity;
    for (const d of dists) {
      if (d < bestDist) bestDist = d;
    }
    if (!Number.isFinite(bestDist)) return outcomeOf(-1);
    const out = new Array<number>(playerCount).fill(0);
    let sum = 0;
    for (let i = 0; i < playerCount; i++) {
      const d = dists[i];
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
        if (path && path.length > 0) {
          action = { type: 'MOVE', to: { ...path[0] } };
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
            const slot = findBlockingWall(st, mover.id, foe, effectiveHorizon);
            if (slot) {
              action = { type: 'PLACE_WALL', wall: slot };
              break;
            }
          }
        }
      }
      if (!action && mover.wallsRemaining > 0) {
        const walls = probableWalls(st, mover.id, effectiveHorizon);
        if (walls.length > 0 && rng() < 0.5) {
          const slot = walls[Math.floor(rng() * walls.length)];
          action = { type: 'PLACE_WALL', wall: slot };
        }
      }
      if (!action) {
        const legal = getLegalMoves(st, mover.id);
        if (legal.length === 0) break;
        const to = legal[Math.floor(rng() * legal.length)];
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
        if (child.visits >= best.visits * 0.3) {
          const childRate = child.visits > 0 ? child.rewards[rootMover.index] / child.visits : 0;
          const bestRate = best.visits > 0 ? best.rewards[rootMover.index] / best.visits : 0;
          if (childRate >= bestRate - 0.08) {
            best = child;
            break;
          }
        }
      }
    }

    const bestRate = best.visits > 0 ? best.rewards[rootMover.index] / best.visits : 0;
    lastMctsStats = {
      simulations,
      nodes: nodeCount,
      elapsedMs: Date.now() - started,
      bestVisits: best.visits,
      bestWinRate: bestRate,
    };

    // Losing-rescue: if we have NO walls left and collapsing, march along shortest path
    if (bestRate < 0.1 && rootMover.wallsRemaining === 0) {
      const path = getShortestPath(rootMover.position, rootMover.goalDirection, state.walls, state.mode);
      if (path && path.length > 0) {
        const to = path[0];
        if (getLegalMoves(state, rootMover.id).some((c) => c.row === to.row && c.col === to.col)) {
          lastMctsStats.elapsedMs = Date.now() - started;
          return { type: 'MOVE', to: { ...to } };
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
  const deadline = opts.timeBudgetMs ? Date.now() + opts.timeBudgetMs : Infinity;
  for (let sim = 0; sim < session.simulations; sim++) {
    if (sim > 16 && (sim & 15) === 0 && Date.now() >= deadline) {
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
  const deadline = opts.timeBudgetMs ? Date.now() + opts.timeBudgetMs : Infinity;
  const CHUNK_SIZE = 150;
  for (let sim = 0; sim < session.simulations; sim += CHUNK_SIZE) {
    if (hooks?.shouldCancel?.()) return null;
    const end = Math.min(session.simulations, sim + CHUNK_SIZE);
    for (let i = sim; i < end; i++) {
      session.stepSimulation();
    }
    if (Date.now() >= deadline) break;
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return session.finalize();
}
