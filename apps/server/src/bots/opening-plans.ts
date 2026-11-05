import {
  getLegalMoves,
  getShortestDistance,
  isLegalMove,
  isLegalWallPlacement,
  type GameAction,
  type GameState,
  type WallCoord,
} from '@duoorb/game-core';
import type { BotPlaystyle } from './bot-roster.js';

/**
 * Opening variety with real Quoridor playstyles & classical lines.
 *
 * An opening plan is a short list of INTENTS the bot tries on its own first
 * moves. Intents are resolved against the live position every time, so a plan
 * can never produce an illegal move or a blunder: each intent is validated and,
 * if it does not fit the board (or would cost real strength), it is skipped and
 * the engine plays that move instead.
 *
 *   A         advance along a shortest path
 *   L/R       sidestep one column left/right without losing distance
 *   WF/WR/WL  an early wall: in front of the rival (front, shifted right, shifted left)
 *   WV        vertical wall beside the rival
 *   REED      Dr. Scott Reed opening: horizontal choke wall with central gap
 *   SHILLER   classical Larry Shiller defense vertical divider wall across central files
 *   SPLIT     deep central vertical divider wall between columns 3-4 or 4-5
 *   FLANK     corridor narrowing wall along flank columns (1-2 or 6-7)
 *   GAP       gap-opening wall leaving a calculated tactical escape route
 *   COUNTER   tactical counter-wall to equalize or punish aggressive moves
 */
export type OpeningIntent =
  | 'A'
  | 'L'
  | 'R'
  | 'WF'
  | 'WR'
  | 'WL'
  | 'WV'
  | 'REED'
  | 'SHILLER'
  | 'SPLIT'
  | 'FLANK'
  | 'GAP'
  | 'COUNTER';

export type OpeningPlan = readonly OpeningIntent[];

const PLAN_LENGTH = 5;

/**
 * 10 distinct playstyle opening pools with 12 curated variations each
 * (120 signature opening plans total across the full 120-bot roster).
 */
export const PLAYSTYLE_PLANS: Record<BotPlaystyle, readonly OpeningPlan[]> = {
  early_wall: [
    ['WF', 'A', 'A', 'A', 'A'],
    ['SPLIT', 'A', 'A', 'A', 'A'],
    ['REED', 'A', 'A', 'A', 'A'],
    ['FLANK', 'A', 'A', 'A', 'A'],
    ['A', 'WF', 'A', 'A', 'A'],
    ['A', 'WR', 'A', 'A', 'A'],
    ['A', 'WV', 'A', 'A', 'A'],
    ['A', 'REED', 'A', 'A', 'A'],
    ['REED', 'A', 'REED', 'A', 'A'],
    ['SPLIT', 'A', 'WF', 'A', 'A'],
    ['FLANK', 'A', 'WF', 'A', 'A'],
    ['A', 'WF', 'WF', 'A', 'A'],
  ],
  reed: [
    ['REED', 'A', 'A', 'A', 'A'],
    ['A', 'REED', 'A', 'A', 'A'],
    ['REED', 'A', 'REED', 'A', 'A'],
    ['A', 'REED', 'REED', 'A', 'A'],
    ['A', 'A', 'REED', 'A', 'A'],
    ['REED', 'A', 'WF', 'A', 'A'],
    ['A', 'REED', 'WF', 'A', 'A'],
    ['REED', 'A', 'A', 'REED', 'A'],
    ['A', 'A', 'REED', 'REED', 'A'],
    ['A', 'A', 'REED', 'WF', 'A'],
    ['REED', 'A', 'SPLIT', 'A', 'A'],
    ['A', 'REED', 'SPLIT', 'A', 'A'],
  ],
  shiller: [
    ['A', 'SHILLER', 'A', 'A', 'A'],
    ['A', 'A', 'SHILLER', 'A', 'A'],
    ['A', 'SHILLER', 'WF', 'A', 'A'],
    ['A', 'A', 'A', 'SHILLER', 'A'],
    ['SHILLER', 'A', 'A', 'A', 'A'],
    ['A', 'SHILLER', 'SHILLER', 'A', 'A'],
    ['A', 'SHILLER', 'WV', 'A', 'A'],
    ['A', 'A', 'SHILLER', 'WF', 'A'],
    ['A', 'A', 'SHILLER', 'WV', 'A'],
    ['A', 'SHILLER', 'A', 'WF', 'A'],
    ['A', 'A', 'A', 'SHILLER', 'WF'],
    ['SHILLER', 'A', 'WF', 'A', 'A'],
  ],
  split: [
    ['SPLIT', 'A', 'A', 'A', 'A'],
    ['A', 'SPLIT', 'A', 'A', 'A'],
    ['A', 'A', 'SPLIT', 'A', 'A'],
    ['SPLIT', 'A', 'SPLIT', 'A', 'A'],
    ['A', 'SPLIT', 'SPLIT', 'A', 'A'],
    ['A', 'SPLIT', 'WV', 'A', 'A'],
    ['A', 'A', 'A', 'SPLIT', 'A'],
    ['SPLIT', 'A', 'WF', 'A', 'A'],
    ['A', 'SPLIT', 'WF', 'A', 'A'],
    ['A', 'A', 'SPLIT', 'WF', 'A'],
    ['A', 'A', 'SPLIT', 'WV', 'A'],
    ['SPLIT', 'A', 'A', 'SPLIT', 'A'],
  ],
  flank: [
    ['FLANK', 'A', 'A', 'A', 'A'],
    ['A', 'FLANK', 'A', 'A', 'A'],
    ['A', 'A', 'FLANK', 'A', 'A'],
    ['FLANK', 'A', 'FLANK', 'A', 'A'],
    ['A', 'FLANK', 'FLANK', 'A', 'A'],
    ['A', 'L', 'FLANK', 'A', 'A'],
    ['A', 'R', 'FLANK', 'A', 'A'],
    ['A', 'FLANK', 'WF', 'A', 'A'],
    ['A', 'A', 'FLANK', 'WF', 'A'],
    ['A', 'A', 'A', 'FLANK', 'A'],
    ['FLANK', 'A', 'WF', 'A', 'A'],
    ['A', 'FLANK', 'A', 'FLANK', 'A'],
  ],
  gap: [
    ['A', 'GAP', 'A', 'A', 'A'],
    ['A', 'A', 'GAP', 'A', 'A'],
    ['GAP', 'A', 'A', 'A', 'A'],
    ['A', 'GAP', 'WF', 'A', 'A'],
    ['A', 'A', 'GAP', 'WF', 'A'],
    ['A', 'GAP', 'A', 'WF', 'A'],
    ['GAP', 'A', 'WF', 'A', 'A'],
    ['A', 'A', 'A', 'GAP', 'A'],
    ['A', 'GAP', 'GAP', 'A', 'A'],
    ['A', 'GAP', 'WV', 'A', 'A'],
    ['A', 'A', 'GAP', 'WV', 'A'],
    ['GAP', 'A', 'A', 'GAP', 'A'],
  ],
  counter: [
    ['A', 'COUNTER', 'A', 'A', 'A'],
    ['A', 'A', 'COUNTER', 'A', 'A'],
    ['A', 'A', 'WF', 'COUNTER', 'A'],
    ['A', 'COUNTER', 'WV', 'A', 'A'],
    ['COUNTER', 'A', 'A', 'A', 'A'],
    ['A', 'COUNTER', 'COUNTER', 'A', 'A'],
    ['A', 'A', 'COUNTER', 'COUNTER', 'A'],
    ['A', 'COUNTER', 'WF', 'A', 'A'],
    ['A', 'A', 'COUNTER', 'WF', 'A'],
    ['A', 'A', 'A', 'COUNTER', 'A'],
    ['A', 'A', 'A', 'COUNTER', 'WF'],
    ['A', 'COUNTER', 'A', 'COUNTER', 'A'],
  ],
  evasive: [
    ['A', 'L', 'A', 'A', 'A'],
    ['A', 'R', 'A', 'A', 'A'],
    ['A', 'L', 'A', 'R', 'A'],
    ['A', 'R', 'A', 'L', 'A'],
    ['A', 'L', 'WF', 'A', 'A'],
    ['A', 'R', 'WF', 'A', 'A'],
    ['A', 'L', 'FLANK', 'A', 'A'],
    ['A', 'R', 'FLANK', 'A', 'A'],
    ['L', 'A', 'A', 'A', 'A'],
    ['R', 'A', 'A', 'A', 'A'],
    ['A', 'L', 'A', 'WF', 'A'],
    ['A', 'R', 'A', 'WF', 'A'],
  ],
  tempo: [
    ['A', 'A', 'A', 'WF', 'A'],
    ['A', 'A', 'A', 'WR', 'A'],
    ['A', 'A', 'WF', 'A', 'A'],
    ['A', 'A', 'WR', 'A', 'A'],
    ['A', 'A', 'WV', 'A', 'A'],
    ['A', 'A', 'SPLIT', 'A', 'A'],
    ['A', 'A', 'SHILLER', 'A', 'A'],
    ['A', 'A', 'A', 'SPLIT', 'A'],
    ['A', 'A', 'A', 'SHILLER', 'A'],
    ['A', 'A', 'A', 'COUNTER', 'A'],
    ['A', 'A', 'WF', 'WF', 'A'],
    ['A', 'A', 'WF', 'A', 'WF'],
  ],
  rush: [
    ['A', 'A', 'A', 'A', 'A'],
    ['A', 'A', 'A', 'A', 'WF'],
    ['A', 'A', 'A', 'A', 'WR'],
    ['A', 'A', 'A', 'A', 'WV'],
    ['A', 'A', 'A', 'A', 'COUNTER'],
    ['A', 'A', 'A', 'WF', 'A'],
    ['A', 'A', 'A', 'WR', 'A'],
    ['A', 'A', 'WF', 'A', 'A'],
    ['A', 'A', 'WR', 'A', 'A'],
    ['A', 'A', 'A', 'A', 'SPLIT'],
    ['A', 'A', 'A', 'A', 'SHILLER'],
    ['A', 'A', 'A', 'COUNTER', 'A'],
  ],
};

/**
 * All 120 curated opening plans flattened in deterministic order:
 * exactly one signature opening plan per bot in the 120-bot roster!
 */
export const CURATED_120_OPENINGS: readonly OpeningPlan[] = [
  ...PLAYSTYLE_PLANS.early_wall,
  ...PLAYSTYLE_PLANS.reed,
  ...PLAYSTYLE_PLANS.shiller,
  ...PLAYSTYLE_PLANS.split,
  ...PLAYSTYLE_PLANS.flank,
  ...PLAYSTYLE_PLANS.gap,
  ...PLAYSTYLE_PLANS.counter,
  ...PLAYSTYLE_PLANS.evasive,
  ...PLAYSTYLE_PLANS.tempo,
  ...PLAYSTYLE_PLANS.rush,
];

function buildPlans(): OpeningPlan[] {
  const intents: OpeningIntent[] = ['A', 'L', 'R', 'WF', 'WR', 'WV'];
  const isSide = (i: OpeningIntent) => i === 'L' || i === 'R';
  const isWall = (i: OpeningIntent) => i === 'WF' || i === 'WR' || i === 'WV';
  const plans: OpeningPlan[] = [];

  const walk = (prefix: OpeningIntent[]): void => {
    if (prefix.length === PLAN_LENGTH) {
      plans.push(prefix);
      return;
    }
    for (const next of intents) {
      const sides = prefix.filter(isSide).length + (isSide(next) ? 1 : 0);
      const walls = prefix.filter(isWall).length + (isWall(next) ? 1 : 0);
      if (sides > 1 || walls > 1) continue;
      // Never open with a wall; walls only from the third own move on.
      if (isWall(next) && prefix.length < 2) continue;
      walk([...prefix, next]);
    }
  };
  walk([]);
  return plans;
}

/** ~90 distinct deterministic plans. */
export const OPENING_PLANS: readonly OpeningPlan[] = buildPlans();

/** Plans without sidesteps, for strong personas that should not waste tempo. */
export const STRONG_OPENING_PLANS: readonly OpeningPlan[] = OPENING_PLANS.filter(
  (plan) => !plan.includes('L') && !plan.includes('R')
);

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a plan for one game. `recentPlanIds` are the plans this user has just
 * faced; they are excluded so consecutive games never open the same way.
 * When `personaIdentifier` is supplied, assigns that bot's signature opening from
 * the 120 curated book plans.
 */
export function pickOpeningPlan(
  userId: string,
  gameId: string,
  playstyleOrStrong: BotPlaystyle | boolean,
  recentPlanIds: readonly number[] = [],
  personaIdentifier?: string | number
): { id: number; plan: OpeningPlan } {
  let pool: readonly OpeningPlan[];
  let preferredSignaturePlan: OpeningPlan | undefined;

  if (typeof playstyleOrStrong === 'string' && PLAYSTYLE_PLANS[playstyleOrStrong]) {
    pool = PLAYSTYLE_PLANS[playstyleOrStrong];
  } else {
    pool = playstyleOrStrong === true ? STRONG_OPENING_PLANS : OPENING_PLANS;
  }

  if (personaIdentifier !== undefined) {
    let botIndex = -1;
    if (typeof personaIdentifier === 'number') {
      botIndex = personaIdentifier;
    } else if (typeof personaIdentifier === 'string') {
      const match = /usr_bot_[a-z]{2}_(\d+)/.exec(personaIdentifier) ?? /usr_bot_(\d+)/.exec(personaIdentifier);
      if (match) {
        botIndex = parseInt(match[1], 10) - 1;
      }
    }
    if (botIndex >= 0 && botIndex < CURATED_120_OPENINGS.length) {
      preferredSignaturePlan = CURATED_120_OPENINGS[botIndex];
    }
  }

  const recent = new Set(recentPlanIds);

  // If this bot has a distinct signature plan among the 120 and it wasn't recently played, play it!
  if (preferredSignaturePlan && !recent.has(globalPlanId(preferredSignaturePlan))) {
    return { id: globalPlanId(preferredSignaturePlan), plan: preferredSignaturePlan };
  }

  // Otherwise select among the playstyle variations, excluding recently faced plans
  const indices: number[] = [];
  pool.forEach((plan, idx) => {
    if (!recent.has(globalPlanId(plan))) indices.push(idx);
  });
  const usable = indices.length > 0 ? indices : pool.map((_, idx) => idx);
  const chosen = pool[usable[hash32(`${userId}|${gameId}`) % usable.length]];
  return { id: globalPlanId(chosen), plan: chosen };
}

export function globalPlanId(plan: OpeningPlan): number {
  const curatedIdx = CURATED_120_OPENINGS.findIndex(
    (c) => c.length === plan.length && c.every((intent, i) => intent === plan[i])
  );
  if (curatedIdx !== -1) return curatedIdx;

  const idx = OPENING_PLANS.findIndex((candidate) => candidate === plan);
  if (idx !== -1) return 200 + idx;
  return 1000 + (hash32(plan.join(':')) % 10000);
}

function distanceOf(
  state: GameState,
  playerId: string,
  walls: WallCoord[] = state.walls
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return Infinity;
  return getShortestDistance(player.position, player.goalDirection, walls, state.mode);
}

/**
 * Resolve one intent to a concrete, legal, non-harmful action, or null when
 * the position does not fit (caller falls back to the engine).
 */
export function resolveOpeningIntent(
  state: GameState,
  botPlayerId: string,
  intent: OpeningIntent
): GameAction | null {
  const bot = state.players.find((p) => p.id === botPlayerId);
  if (!bot || state.players.length !== 2) return null;
  const rival = state.players.find((p) => p.id !== botPlayerId);
  if (!rival) return null;
  const current = distanceOf(state, botPlayerId);

  if (intent === 'A') {
    let best: { to: { row: number; col: number }; dist: number } | null = null;
    for (const to of getLegalMoves(state, botPlayerId)) {
      const dist = getShortestDistance(to, bot.goalDirection, state.walls, state.mode);
      if (dist < current && (!best || dist < best.dist)) best = { to, dist };
    }
    return best ? { type: 'MOVE', to: best.to } : null;
  }

  if (intent === 'L' || intent === 'R') {
    const to = { row: bot.position.row, col: bot.position.col + (intent === 'L' ? -1 : 1) };
    if (!isLegalMove(state, botPlayerId, to)) return null;
    const dist = getShortestDistance(to, bot.goalDirection, state.walls, state.mode);
    return dist <= current ? { type: 'MOVE', to } : null;
  }

  // Walls: direction-aware and classical Quoridor opening geometry
  const rivalForward = rival.goalDirection;
  const rr = rival.position.row;
  const rc = rival.position.col;
  const candidates: WallCoord[] = [];

  if (intent === 'WF' || intent === 'WR' || intent === 'WL') {
    const frontRow =
      rivalForward === 'TOP' ? rr - 1 : rivalForward === 'BOTTOM' ? rr : null;
    if (frontRow !== null && frontRow >= 0 && frontRow <= 7) {
      if (intent === 'WF') {
        candidates.push(
          { row: frontRow, col: Math.max(0, rc - 1), orientation: 'H' },
          { row: frontRow, col: Math.min(7, rc), orientation: 'H' }
        );
      } else if (intent === 'WR') {
        candidates.push({ row: frontRow, col: Math.min(7, rc), orientation: 'H' });
      } else {
        candidates.push({ row: frontRow, col: Math.max(0, rc - 1), orientation: 'H' });
      }
    }
  } else if (intent === 'WV') {
    const row = rivalForward === 'TOP' ? Math.max(0, rr - 1) : Math.min(7, rr);
    candidates.push(
      { row, col: Math.min(7, rc), orientation: 'V' },
      { row, col: Math.max(0, rc - 1), orientation: 'V' }
    );
  } else if (intent === 'REED') {
    // Dr. Scott Reed opening: horizontal choke wall with central gap across rival's 2nd/3rd rank
    const reedRow = rivalForward === 'TOP' ? 5 : 2;
    candidates.push(
      { row: reedRow, col: 1, orientation: 'H' },
      { row: reedRow, col: 5, orientation: 'H' },
      { row: reedRow, col: 0, orientation: 'H' },
      { row: reedRow, col: 6, orientation: 'H' },
      { row: reedRow === 5 ? 6 : 1, col: 2, orientation: 'H' },
      { row: reedRow === 5 ? 6 : 1, col: 4, orientation: 'H' }
    );
  } else if (intent === 'SHILLER') {
    // Classical Larry Shiller vertical divider wall splitting center files
    candidates.push(
      { row: 2, col: 3, orientation: 'V' },
      { row: 3, col: 3, orientation: 'V' },
      { row: 4, col: 3, orientation: 'V' },
      { row: 2, col: 4, orientation: 'V' },
      { row: 3, col: 4, orientation: 'V' },
      { row: 4, col: 4, orientation: 'V' },
      { row: rivalForward === 'TOP' ? 4 : 3, col: 3, orientation: 'H' },
      { row: rivalForward === 'TOP' ? 4 : 3, col: 4, orientation: 'H' }
    );
  } else if (intent === 'SPLIT') {
    // Deep central vertical divider breaking board symmetry
    candidates.push(
      { row: 1, col: 3, orientation: 'V' },
      { row: 3, col: 3, orientation: 'V' },
      { row: 5, col: 3, orientation: 'V' },
      { row: 1, col: 4, orientation: 'V' },
      { row: 3, col: 4, orientation: 'V' },
      { row: 5, col: 4, orientation: 'V' }
    );
  } else if (intent === 'FLANK') {
    // Flank corridor traps narrowing outer lanes
    candidates.push(
      { row: 2, col: 1, orientation: 'V' },
      { row: 3, col: 1, orientation: 'V' },
      { row: 4, col: 1, orientation: 'V' },
      { row: 2, col: 6, orientation: 'V' },
      { row: 3, col: 6, orientation: 'V' },
      { row: 4, col: 6, orientation: 'V' },
      { row: rivalForward === 'TOP' ? 5 : 2, col: 0, orientation: 'H' },
      { row: rivalForward === 'TOP' ? 5 : 2, col: 6, orientation: 'H' }
    );
  } else if (intent === 'GAP') {
    // Gap opening: strategic horizontal barrier with an intentional bypass slot
    const gapRow = rivalForward === 'TOP' ? 5 : 2;
    candidates.push(
      { row: gapRow, col: 0, orientation: 'H' },
      { row: gapRow, col: 3, orientation: 'H' },
      { row: gapRow, col: 6, orientation: 'H' },
      { row: gapRow === 5 ? 4 : 3, col: 1, orientation: 'H' },
      { row: gapRow === 5 ? 4 : 3, col: 5, orientation: 'H' }
    );
  } else if (intent === 'COUNTER') {
    const front = rivalForward === 'TOP' ? rr - 1 : rr;
    if (front >= 0 && front <= 7) {
      candidates.push(
        { row: front, col: Math.max(0, rc - 1), orientation: 'H' },
        { row: front, col: Math.min(7, rc), orientation: 'H' }
      );
    }
    const vRow = Math.max(0, Math.min(7, rr - 1));
    candidates.push(
      { row: vRow, col: Math.max(0, rc - 1), orientation: 'V' },
      { row: vRow, col: Math.min(7, rc), orientation: 'V' }
    );
  }

  const rivalBefore = distanceOf(state, rival.id);
  for (const wall of candidates) {
    if (wall.row < 0 || wall.row > 7 || wall.col < 0 || wall.col > 7) continue;
    if (!isLegalWallPlacement(state, botPlayerId, wall)) continue;

    const testWalls: WallCoord[] = [
      ...state.walls,
      { ...wall, placedByPlayerId: botPlayerId, sequence: state.history.length + 1 },
    ];
    const rivalAfter = distanceOf(state, rival.id, testWalls);
    const botAfter = distanceOf(state, botPlayerId, testWalls);

    // Rule 1: Never trap either player (path to goal must exist)
    if (botAfter === Infinity || rivalAfter === Infinity) continue;

    // Rule 2: Never shorten the rival's shortest path
    if (rivalAfter < rivalBefore) continue;

    const delayRival = rivalAfter - rivalBefore;
    const delayBot = botAfter - current;

    // Rule 3: Self-harm protection (never make a stupid move)
    // If the wall increases the bot's own distance, only allowed if it penalizes the rival more.
    if (delayBot > 0 && delayRival <= delayBot) continue;

    // Rule 4: Tactical vs Strategic acceptance
    const isTactical =
      intent === 'WF' || intent === 'WR' || intent === 'WL' || intent === 'COUNTER';

    if (isTactical) {
      if (delayRival >= 1 && delayRival >= delayBot) {
        return { type: 'PLACE_WALL', wall };
      }
      continue;
    }

    // Proactive strategic book openings (REED, SHILLER, SPLIT, FLANK, GAP, WV):
    // Shapes board terrain safely as long as bot suffers 0 self-harm (delayBot <= 0).
    if (delayBot <= 0) {
      return { type: 'PLACE_WALL', wall };
    }
  }

  return null;
}
