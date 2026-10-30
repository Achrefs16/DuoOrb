import type { GameAction, GameState, PlayerState } from '../types.js';
import { isGoalCell } from '../pathfinding.js';
import type { AIProfile } from './types.js';

/**
 * A root action returned by the native Rust search. `q` is the mover's
 * average reward in [0, 1]; `visits` is the aggregate visit count across all
 * native worker trees.
 */
export interface NativeRankedAction {
  action: GameAction;
  visits: number;
  q: number;
}

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function manhattan(a: { row: number; col: number }, b: { row: number; col: number }): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

/**
 * Stable per-profile jitter. Bots with the same broad wall style still differ
 * in which near-equal wall or move they prefer, without using the live seed.
 */
function profileFingerprint(profile: AIProfile): number {
  let hash = 2166136261;
  const values = [
    profile.simulations ?? 3000,
    (profile.wallMoveProb ?? 0.35) * 1000,
    (profile.blockMoveProb ?? 0.5) * 1000,
    profile.weights.pathDifference,
    profile.weights.wallAdvantage,
    profile.weights.mobility,
    profile.weights.pathways,
    profile.weights.tightness,
    profile.weights.placement,
  ];
  for (const value of values) {
    hash ^= Math.round(value * 1000);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296 - 0.5;
}

function nearestOpponentDistance(
  state: GameState,
  player: PlayerState,
  cell: { row: number; col: number }
): number {
  let best = Infinity;
  for (const other of state.players) {
    if (other.id === player.id || other.status !== 'ACTIVE') continue;
    best = Math.min(best, manhattan(other.position, cell));
  }
  return best;
}

/**
 * Older hard-bot profiles predate the explicit style fields. Derive a stable
 * style from their tuning so every hard bot still has a distinct identity
 * instead of all 18 collapsing onto the same native search.
 */
function inferWallStyle(profile: AIProfile): NonNullable<AIProfile['wallStyle']> {
  if (profile.wallStyle) return profile.wallStyle;
  if ((profile.blockMoveProb ?? 0) >= 0.85) return 'defensive_backwall';
  if ((profile.wallMoveProb ?? 0.35) >= 0.42) return 'horizontal_barricade';
  if ((profile.wallMoveProb ?? 0.35) <= 0.32) return 'minimal';
  if (profile.weights.pathways >= 1.15) return 'vertical_corridor';
  if (profile.weights.wallAdvantage >= 2.1) return 'flank_trap';
  return 'balanced';
}

function inferOpeningStyle(profile: AIProfile): NonNullable<AIProfile['openingStyle']> {
  if (profile.openingStyle) return profile.openingStyle;
  if ((profile.wallMoveProb ?? 0.35) >= 0.42) return 'early_fence';
  if (profile.weights.pathDifference >= 15) return 'center_march';
  if (profile.weights.mobility >= 1.0) return 'wing_drift';
  if (profile.weights.tightness >= 1.6) return 'back_gate';
  return 'mixed';
}

function openingBias(
  profile: AIProfile,
  player: PlayerState,
  to: { row: number; col: number },
  isOpening: boolean,
  openingStyle: NonNullable<AIProfile['openingStyle']>
): number {
  if (!isOpening) return 0;
  switch (openingStyle) {
    case 'center_march': {
      const centerDistance = Math.abs(to.row - 4) + Math.abs(to.col - 4);
      return (4 - centerDistance) * 0.006;
    }
    case 'wing_drift': {
      const edgeDistance = Math.min(to.row, 8 - to.row, to.col, 8 - to.col);
      return edgeDistance * 0.004;
    }
    case 'back_gate': {
      // Prefer the player's starting half rather than a full early sprint.
      switch (player.goalDirection) {
        case 'BOTTOM':
          return Math.max(0, to.row - 4) * 0.004;
        case 'TOP':
          return Math.max(0, 4 - to.row) * 0.004;
        case 'RIGHT':
          return Math.max(0, to.col - 4) * 0.004;
        case 'LEFT':
          return Math.max(0, 4 - to.col) * 0.004;
      }
    }
    case 'early_fence':
      return -0.015;
    default:
      return 0;
  }
}

function wallStyleBias(
  profile: AIProfile,
  state: GameState,
  player: PlayerState,
  wall: { row: number; col: number; orientation: 'H' | 'V' },
  isOpening: boolean,
  wallStyle: NonNullable<AIProfile['wallStyle']>,
  openingStyle: NonNullable<AIProfile['openingStyle']>
): number {
  let score = 0;
  const center = { row: wall.row + 0.5, col: wall.col + 0.5 };
  const ownDistance = manhattan(player.position, center);
  const rivalDistance = nearestOpponentDistance(state, player, center);

  switch (wallStyle) {
    case 'horizontal_barricade':
      score += wall.orientation === 'H' ? 0.020 : -0.008;
      break;
    case 'vertical_corridor':
      score += wall.orientation === 'V' ? 0.020 : -0.008;
      break;
    case 'defensive_backwall':
      score += ownDistance <= 3 ? 0.018 : -0.006;
      break;
    case 'flank_trap':
      score += rivalDistance <= 3 ? 0.018 : -0.006;
      break;
    case 'minimal':
      score -= 0.025;
      break;
    case 'balanced':
    default:
      break;
  }

  if (openingStyle === 'early_fence' && isOpening) {
    score += 0.025;
  }

  // Profiles that like walls should lean toward walls; profiles that prefer
  // running should lean toward pawn moves. The effect is deliberately small:
  // style decides close positions, not lost ones.
  const wallPreference = (profile.wallMoveProb ?? 0.35) - 0.35;
  score += wallPreference * 0.02;
  return score;
}

function isImmediateWin(state: GameState, player: PlayerState, action: GameAction): boolean {
  return action.type === 'MOVE' && isGoalCell(action.to, player.goalDirection, state.mode);
}

/**
 * Pick a native root action through the bot's personality.
 *
 * The native search supplies the strength and the evaluated alternatives; this
 * layer only chooses among actions that are already close in Q. Hard bots can
 * therefore keep their wall/opening identity without replacing the search with
 * a weak heuristic.
 */
export function selectNativePersonalityAction(
  state: GameState,
  profile: AIProfile,
  ranked: NativeRankedAction[],
  seed: number
): GameAction | null {
  if (ranked.length === 0) return null;

  const player = state.players[state.currentPlayerIndex];
  if (!player) return null;

  const candidates = ranked
    .filter((candidate) => Number.isFinite(candidate.q) && candidate.visits > 0)
    .sort((a, b) => b.visits - a.visits || b.q - a.q);
  if (candidates.length === 0) return ranked[0]?.action ?? null;

  // Never throw away a win that the native search has already found.
  for (const candidate of candidates) {
    if (isImmediateWin(state, player, candidate.action)) {
      return candidate.action;
    }
  }

  const bestVisits = candidates[0].visits;
  const bestQ = Math.max(...candidates.map((candidate) => candidate.q));
  if (bestQ >= 0.93) {
    return candidates.reduce((best, candidate) =>
      candidate.q > best.q ? candidate : best
    ).action;
  }

  const isOpening = state.moveNumber <= Math.max(2, state.players.length * 2);
  const wallStyle = inferWallStyle(profile);
  const openingStyle = inferOpeningStyle(profile);
  const rng = makeRng(seed ^ 0x9e3779b9);
  // Hard bots get a slightly wider Q window so a real style preference
  // (horizontal vs vertical walls, for example) can express itself among
  // near-equal lines. The window is still narrow enough that a clearly losing
  // action cannot be chosen for flavor.
  const window = Math.max(
    profile.varietyWindow ?? 0.04,
    profile.difficulty === 'hard' ? 0.055 : 0.035
  );
  // Root-parallel search splits visits across eight worker trees, so the
  // second-best root action legitimately has a much smaller visit count than
  // the leader. Keep the Q window as the strength guard and use a low visit
  // floor only to discard noise.
  const minVisitRatio = profile.difficulty === 'hard' ? 0.10 : 0.18;
  const pool = candidates
    .filter(
      (candidate) =>
        candidate.q >= bestQ - window && candidate.visits >= bestVisits * minVisitRatio
    )
    .slice(0, 16);

  if (pool.length === 0) return candidates[0].action;
  if (pool.length === 1) return pool[0].action;

  const fingerprint = profileFingerprint(profile);
  const scored = pool.map((candidate) => {
    let style = fingerprint * 0.006;
    if (candidate.action.type === 'MOVE') {
      style += openingBias(profile, player, candidate.action.to, isOpening, openingStyle);
      style += (0.35 - (profile.wallMoveProb ?? 0.35)) * 0.01;
      style += (profile.weights.pathDifference - 12) * 0.0015;
      style += (profile.weights.mobility - 0.8) * 0.004;
      style += (profile.weights.placement - 2) * 0.001;
    } else if (candidate.action.type === 'PLACE_WALL') {
      style += wallStyleBias(
        profile,
        state,
        player,
        candidate.action.wall,
        isOpening,
        wallStyle,
        openingStyle
      );
      style += (profile.weights.wallAdvantage - 1.5) * 0.004;
      style += (profile.weights.tightness - 1.2) * 0.003;
      style += (profile.weights.placement - 2) * 0.001;
    }
    const jitter = (rng() - 0.5) * 2 * profile.randomness * 0.05;
    return { action: candidate.action, score: candidate.q + style + jitter };
  });

  // A deliberate human-like lapse: choose a plausible but not top-ranked move.
  if ((profile.blunderRate ?? 0) > 0 && rng() < (profile.blunderRate ?? 0)) {
    const lapsePool = candidates
      .filter(
        (candidate) =>
          candidate.q >= bestQ - Math.max(0.10, window * 3) &&
          candidate.visits >= bestVisits * 0.10
      )
      .slice(1, 4);
    if (lapsePool.length > 0) {
      return lapsePool[Math.floor(rng() * lapsePool.length)].action;
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (profile.randomness <= 0 || scored.length === 1) {
    return scored[0].action;
  }

  // Small temperature sampling among near-equal moves. Hard bots use a sharp
  // temperature; Jamal-style profiles get a little more variety.
  const temperature = Math.max(0.03, profile.softmaxTemp ?? 0.15);
  const weights = scored.map((entry) => Math.exp(entry.score / temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let pick = rng() * total;
  for (let i = 0; i < scored.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return scored[i].action;
  }
  return scored[0].action;
}
