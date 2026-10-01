import type { GameAction, GameState } from '../types.js';
import type { AIProfile, RankedAction, RankOptions, ScoredCandidate } from './types.js';
import {
  beginEpoch,
  boardOf,
  packSlot,
  routeOf,
} from '../ai-structure.js';
import {
  exchangeOutcome,
  forecastSeal,
  planDamageAfter,
  readStrategicState,
  resetAttackMemo,
  resetFragilityMemo,
  resetStrategicMemo,
} from '../ai-threat.js';
import { applyAction, bestRemainingPlace } from '../ruleset.js';
import { isGoalCell } from '../pathfinding.js';
import { buildRootCandidates, compareCandidates } from './candidates.js';
import {
  DEEP_WALL_SHARE,
  DEFAULT_WALL_TUNING,
  ATTACK_CREDIT_CAP,
  ATTACK_SHARE,
  ON_PATH_BONUS,
  PLACEMENT_STEP,
  PLAN_DEFENCE_BAR,
  PREVENT_BAR,
  RACING_BONUS,
  RIVAL_PRESSURE_STEPS,
  ROOT_STRUCTURE_CAP_SHARE,
  SPARE_WALLS,
  SPEND_TIEBREAK,
  TIE_EPSILON,
  WIN_SCORE,
} from './constants.js';
import { jumpTrapPenalty, repetitionPenalty, resetMobilityMemo } from './evaluation.js';
import { newSearchContext, searchNode } from './search.js';
import { readTacticalState, rivalPressureOnMe } from './tactics.js';

export let lastSearchNodes = 0;
export let lastSearchTruncated = false;

const STRUCTURE_SHARE = 0.5;

export function rankActions(
  state: GameState,
  playerId: string,
  profile: AIProfile,
  opts: RankOptions = {}
): RankedAction[] {
  if (state.status !== 'IN_PROGRESS') return [];
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return [];

  const depth = Math.max(1, Math.floor(opts.depth ?? profile.depth));
  const tactical = opts.tactical ?? readTacticalState(state, playerId);

  const searchProfile: AIProfile =
    depth > profile.depth && !opts.candidates
      ? { ...profile, maxCandidateWalls: Math.max(2, Math.floor(profile.maxCandidateWalls * DEEP_WALL_SHARE)) }
      : profile;

  beginEpoch();
  resetMobilityMemo();
  resetStrategicMemo();
  resetAttackMemo();
  resetFragilityMemo();
  const board = boardOf(state);
  const own = routeOf(state, board, me);
  const ctx = opts.ctx ?? newSearchContext(state, playerId, searchProfile, opts.timeBudgetMs);
  ctx.rootDepth = depth;
  lastSearchTruncated = false;
  if (!opts.candidates) lastSearchNodes = 0;

  const candidates =
    opts.candidates ??
    buildRootCandidates(
      state,
      board,
      own,
      playerId,
      searchProfile,
      tactical,
      ctx.deadline,
      opts.strategic ?? null
    );
  if (candidates.length === 0) return [];

  let minOpponentDist = Infinity;
  for (const rival of state.players) {
    if (rival.id === playerId) continue;
    const route = routeOf(state, board, rival);
    if (route.hasGoalAccess && route.distance < minOpponentDist) minOpponentDist = route.distance;
  }

  const racing = own.distance < minOpponentDist;
  const iMoveFirst = state.players[state.currentPlayerIndex]?.id === playerId ? 1 : -1;
  const plyMarginRoot = 2 * (minOpponentDist - own.distance) + iMoveFirst;
  const rivalPressure = rivalPressureOnMe(state, playerId);
  const focus = 1 - profile.randomness;
  const tuning = { ...DEFAULT_WALL_TUNING, ...(opts.tuning ?? {}) };
  const perStep = profile.weights.pathDifference;
  const jitter = !opts.deterministic && opts.rng !== undefined && profile.randomness > 0;
  const finishScore = WIN_SCORE - (bestRemainingPlace(state) - 1) * PLACEMENT_STEP;

  const seal = forecastSeal(state, me, own.distance, opts.strategic ?? null, rivalPressure);
  ctx.sealSlots = seal ? seal.slots : null;

  interface Entry {
    candidate: ScoredCandidate;
    score: number;
    progress: boolean;
    winsNow: boolean;
    after: GameState;
  }

  const entries: Entry[] = [];
  for (const candidate of candidates) {
    const applied = applyAction(state, candidate.action);
    if (!applied.success) continue;
    let score = searchNode(applied.state, depth - 1, -Infinity, Infinity, ctx);
    if (jitter) {
      score += ((opts.rng as () => number)() - 0.5) * 2 * profile.randomness * 10;
    }

    let progress = candidate.onPath;
    let winsNow = false;
    if (candidate.action.type === 'MOVE') {
      const to = candidate.action.to;
      winsNow = isGoalCell(to, me.goalDirection, state.mode);
      if (!progress && !winsNow) {
        const meAfter = applied.state.players.find((p) => p.id === playerId);
        if (meAfter) {
          const after = routeOf(applied.state, boardOf(applied.state), meAfter);
          progress = after.hasGoalAccess && after.distance < own.distance;
        }
      }
    }
    entries.push({ candidate, score, progress, winsNow, after: applied.state });
  }

  const hasProgressMove = entries.some(
    (e) => e.candidate.action.type === 'MOVE' && (e.winsNow || e.progress)
  );

  interface ScoredEntry extends Entry {
    prevention: number;
    affordable: boolean;
    wallCredit: number;
    order: number;
    /**
     * Fresh-danger strip: the rival's re-read plan after this wall is no
     * better than the root forecast and I am behind, so every speculative
     * bonus (attack credit, flips, prevention, suppression) is an illusion
     * measured against a dead plan. The search's objection stands.
     */
    stripped: boolean;
  }

  /**
   * Is the rival's danger after my wall undiminished? Re-reads their plan
   * from the after-state and compares against the root forecast. Prevention
   * measures the OLD plan's death; this catches the NEW plan's birth (their
   * cage has redundancy: steal one brick and they re-plan around it).
   */
  const freshDangerUnreduced = (after: GameState, rootSealDamage: number): boolean => {
    if (after.status !== 'IN_PROGRESS') return false;
    const meAfter = after.players.find((p) => p.id === playerId);
    if (!meAfter || meAfter.status !== 'ACTIVE') return false;
    const boardAfter = boardOf(after);
    const routeAfter = routeOf(after, boardAfter, meAfter);
    if (!routeAfter.hasGoalAccess) return false;
    let near = Infinity;
    for (const rival of after.players) {
      if (rival.id === playerId || rival.status !== 'ACTIVE') continue;
      const r = routeOf(after, boardAfter, rival);
      if (r.hasGoalAccess && r.distance < near) near = r.distance;
    }
    if (!Number.isFinite(near)) return false;
    const fresh = readStrategicState(after, playerId, near);
    const freshSeal = forecastSeal(after, meAfter, routeAfter.distance, fresh, rivalPressureOnMe(after, playerId));
    return !!freshSeal && freshSeal.damage >= rootSealDamage;
  };

  const scored: ScoredEntry[] = entries.map((entry) => {
    let score = entry.score;
    const candidate = entry.candidate;
    let affordable = true;
    let wallCredit = 0;
    // Fresh-danger strip; set in the wall branch below, false for moves
    // (walking out of a seal is tempo, never speculation).
    let stripped = false;

    let prevention = 0;
    if (seal !== null && entry.after.status === 'IN_PROGRESS') {
      const meAfter = entry.after.players.find((p) => p.id === playerId);
      if (meAfter && meAfter.status === 'ACTIVE') {
        const boardAfter = boardOf(entry.after);
        const routeAfter = routeOf(entry.after, boardAfter, meAfter);
        if (routeAfter.hasGoalAccess) {
          prevention = Math.max(
            0,
            seal.damage -
              planDamageAfter(
                boardAfter,
                meAfter.goalDirection,
                meAfter.position,
                routeAfter.distance,
                seal.slots
              )
          );
        }
      }
    }

    if (candidate.action.type === 'MOVE') {
      if (entry.winsNow) {
        score = finishScore;
      } else {
        score -= repetitionPenalty(state, playerId, candidate.action.to) * 0.25 * perStep;
        score -= jumpTrapPenalty(state, board, me, candidate.action) * perStep * focus;
        if (entry.progress) {
          score += ON_PATH_BONUS * focus;
          if (racing) score += RACING_BONUS * focus;
        }
        if (prevention > 0) {
          score += Math.min(prevention, PREVENT_BAR) * perStep * focus;
        }
      }
    } else if (candidate.action.type === 'PLACE_WALL' && candidate.wall) {
      const insight = candidate.wall;
      const baseScore = score;
      const emergency = minOpponentDist <= 1;
      // A brick of my own attack blueprint has bought its tempo even when its
      // immediate delay is zero: the funnel it anchors is the payoff.
      const isAttackBrick =
        candidate.attackSlot === true && opts.attack !== undefined && opts.attack !== null;
      const denies = insight.delay > 0 || isAttackBrick;
      if (hasProgressMove && !(tuning.denialIsTempo && denies)) score -= perStep;

      const delay = insight.delay;
      const wasFirst = own.distance < minOpponentDist;
      const delayReachesFlip = plyMarginRoot >= -2 * delay - 1;
      // This brick's own funnel damage (not the shared best): credit and
      // affordability follow what THIS wall builds.
      let brickDamage = 0;
      if (
        isAttackBrick &&
        opts.attack !== null &&
        opts.attack !== undefined
      ) {
        const at = opts.attack.slots.indexOf(packSlot(insight.slot));
        brickDamage =
          at >= 0 && at < opts.attack.memberDamage.length
            ? opts.attack.memberDamage[at] ?? opts.attack.damage
            : opts.attack.damage;
      }
      // A funnel brick is affordable when completing the funnel flips a race
      // I am not already winning: the spend changes the result, which is the
      // same test the immediate-delay bricks pass through delayReachesFlip.
      const attackFlips =
        isAttackBrick &&
        plyMarginRoot < 2 &&
        plyMarginRoot + 2 * brickDamage >= 2;
      affordable = wasFirst || delayReachesFlip || emergency || prevention > 0 || attackFlips;

      // Fresh-danger gate (see declaration above): behind with a seal
      // closing, and this wall leaves their re-read danger undiminished.
      // Computed only for speculation carriers (attack bricks and walls with
      // measured prevention), so quiet positions pay nothing.
      if (
        seal !== null &&
        seal.damage >= 2 &&
        plyMarginRoot < 0 &&
        (isAttackBrick || prevention > 0)
      ) {
        stripped = freshDangerUnreduced(entry.after, seal.damage);
      }
      if (delay > 0) {
        const pressuring = rivalPressure >= RIVAL_PRESSURE_STEPS;
        const flips = !wasFirst && own.distance < minOpponentDist + delay;
        if (emergency) {
          score += Math.min(perStep * 3, delay * perStep) * 2.5 * focus;
        } else if (pressuring) {
          if (delayReachesFlip && !stripped) {
            score += Math.min(perStep * 2, delay * perStep) * 1.8 * focus;
          }
        } else if (flips && !stripped) {
          score += Math.min(perStep * 3, delay * perStep) * focus;
        }
      }

      let structure = insight.structure * STRUCTURE_SHARE;
      const cap = perStep * ROOT_STRUCTURE_CAP_SHARE;
      if (structure > cap) structure = cap;
      if (racing && delay === 0 && !isAttackBrick) structure = 0;
      if (!affordable) structure = 0;
      score += structure;

      // Offensive funnel credit: this brick earns a share of ITS OWN best
      // funnel's combined damage, capped. Flows into wallCredit below, so it
      // survives the exchange re-rank exactly like the defensive credits do.
      // Stripped with the other speculation when the fresh danger is
      // undiminished.
      if (isAttackBrick && !stripped) {
        score += Math.min(perStep * ATTACK_CREDIT_CAP, brickDamage * perStep * ATTACK_SHARE) * focus;
      }

      const plan = opts.strategic;
      let suppressCredit = 0;
      if (
        plan !== undefined &&
        plan !== null &&
        plan.urgent &&
        !plan.raceDecided &&
        !stripped &&
        insight.planSuppression > 0
      ) {
        const denied = insight.planSuppression * perStep + perStep * 0.5;
        suppressCredit = Math.min(perStep * PLAN_DEFENCE_BAR, denied) * focus;
      }
      let preventCredit = 0;
      if (prevention > 0 && !stripped) {
        preventCredit = Math.min(prevention, PREVENT_BAR) * perStep * focus;
      }
      score += Math.max(suppressCredit, preventCredit);

      if (seal !== null && insight.selfCost === 0 && me.wallsRemaining >= SPARE_WALLS) {
        score += perStep * SPEND_TIEBREAK * focus;
      }
      wallCredit = score - baseScore;
    }

    return {
      candidate,
      score,
      progress: entry.progress,
      winsNow: entry.winsNow,
      prevention,
      after: entry.after,
      affordable,
      wallCredit,
      order: candidate.order,
      stripped,
    };
  });

  const live = opts.strategic;
  const useExchange =
    live !== undefined && live !== null && live.urgent && !live.raceDecided && me.wallsRemaining > 0;
  const reRanked = scored.map((entry) => {
    if (!useExchange) return { ...entry, exchange: null as RankedAction['exchange'] };
    const outcome = exchangeOutcome(state, me, entry.candidate.action, opts.strategic ?? null);
    const mine = Number.isFinite(outcome.myDistance) ? outcome.myDistance : 99;
    const theirs = Number.isFinite(outcome.theirDistance) ? outcome.theirDistance : mine;
    let exchangeScore = -mine * perStep + (theirs - mine) * perStep;
    if (entry.progress) {
      exchangeScore += ON_PATH_BONUS * focus;
    }
    if (entry.candidate.action.type === 'MOVE') {
      exchangeScore -= repetitionPenalty(state, playerId, entry.candidate.action.to) * 0.25 * perStep;
    }

    const residual =
      entry.prevention > 0 && !entry.stripped
        ? Math.min(entry.prevention, PREVENT_BAR) * perStep * focus
        : 0;
    let overhang = 0;
    if (seal !== null && !entry.winsNow && outcome.reply) {
      const second = applyAction(entry.after, outcome.reply);
      if (second.success && second.state.status === 'IN_PROGRESS') {
        const meAfterReply = second.state.players.find((p) => p.id === playerId);
        if (meAfterReply && meAfterReply.status === 'ACTIVE') {
          const boardAfterReply = boardOf(second.state);
          const routeAfterReply = routeOf(second.state, boardAfterReply, meAfterReply);
          if (routeAfterReply.hasGoalAccess) {
            overhang =
              Math.min(
                planDamageAfter(
                  boardAfterReply,
                  meAfterReply.goalDirection,
                  meAfterReply.position,
                  routeAfterReply.distance,
                  seal.slots
                ),
                PREVENT_BAR
              ) *
              perStep *
              focus;
          }
        }
      }
    }
    return {
      ...entry,
      score: entry.winsNow ? entry.score : exchangeScore + residual - overhang + entry.wallCredit,
      exchange: { myDistance: mine, theirDistance: theirs },
    };
  });

  if (hasProgressMove) {
    let bestProgress = -Infinity;
    for (const entry of reRanked) {
      if (entry.winsNow || entry.progress) bestProgress = Math.max(bestProgress, entry.score);
    }
    if (Number.isFinite(bestProgress)) {
      const ceiling = bestProgress - TIE_EPSILON;
      for (const entry of reRanked) {
        if (entry.affordable) continue;
        if (entry.score > ceiling) entry.score = ceiling;
      }
    }
  }

  reRanked.sort((a, b) => {
    if (Math.abs(a.score - b.score) > TIE_EPSILON) return b.score - a.score;
    if (a.winsNow !== b.winsNow) return a.winsNow ? -1 : 1;
    if (a.progress !== b.progress) return a.progress ? -1 : 1;
    const aMove = a.candidate.action.type === 'MOVE';
    const bMove = b.candidate.action.type === 'MOVE';
    if (aMove !== bMove) return aMove ? -1 : 1;
    return a.order - b.order;
  });

  if (ctx.aborted) lastSearchTruncated = true;
  lastSearchNodes += ctx.nodes;
  return reRanked.map(({ candidate, score, progress, winsNow, exchange }) => ({
    action: candidate.action,
    score,
    progress,
    winsNow,
    exchange,
    candidateOrder: candidate.order,
  }));
}
