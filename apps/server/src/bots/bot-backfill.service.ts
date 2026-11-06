import type { MatchmakingRequest } from '../matchmaking/matchmaking.service.js';
import { BOT_PERSONAS, type BotPersona } from './bot-roster.js';
import { pickOpeningPlan, type OpeningPlan } from './opening-plans.js';

export interface BackfillConfig {
  /** Master switch. OFF unless explicitly enabled — production default is untouched. */
  enabled: boolean;
  /** Share of eligible searches (0-100) that may be backfilled. */
  percent: number;
  minWaitMs: number;
  maxWaitMs: number;
}

export function loadBackfillConfig(env: NodeJS.ProcessEnv = process.env): BackfillConfig {
  const num = (raw: string | undefined, fallback: number): number => {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const minWait = Math.max(2000, num(env.BOT_BACKFILL_MIN_WAIT_MS, 5000));
  return {
    enabled: env.BOT_BACKFILL_ENABLED !== 'false',
    percent: Math.min(100, Math.max(0, num(env.BOT_BACKFILL_PERCENT, 100))),
    minWaitMs: minWait,
    maxWaitMs: Math.max(minWait, num(env.BOT_BACKFILL_MAX_WAIT_MS, 20000)),
  };
}

const RECENT_PERSONAS = 4;
const RECENT_OPENINGS = 8;

/**
 * Pure policy for when and against whom a waiting player gets a computer
 * opponent. No sockets, no database: the gateway asks, then acts.
 */
export class BotBackfillService {
  /** `${userId}:${joinedAt}` -> wait threshold in ms (Infinity = never backfill this search). */
  private thresholds = new Map<string, number>();
  private recentPersonas = new Map<string, string[]>();
  private recentOpenings = new Map<string, number[]>();

  constructor(
    private readonly config: BackfillConfig,
    private readonly rng: () => number = Math.random
  ) { }

  get enabled(): boolean {
    return this.config.enabled && this.config.percent > 0;
  }

  /** All 1v1 searches (2p) are eligible for bot backfill */
  isQuickPool(req: MatchmakingRequest): boolean {
    return req.mode === '2p';
  }

  /** Searches that have waited past their (randomised) threshold. */
  dueEntries(queue: readonly MatchmakingRequest[], now = Date.now()): MatchmakingRequest[] {
    if (!this.enabled) return [];
    const live = new Set<string>();
    const due: MatchmakingRequest[] = [];
    for (const req of queue) {
      if (!this.isQuickPool(req)) continue;
      const key = `${req.userId}:${req.joinedAt}`;
      live.add(key);
      let threshold = this.thresholds.get(key);
      if (threshold === undefined) {
        threshold =
          this.rng() * 100 < this.config.percent
            ? this.config.minWaitMs + this.rng() * (this.config.maxWaitMs - this.config.minWaitMs)
            : Infinity;
        this.thresholds.set(key, threshold);
      }
      if (now - req.joinedAt >= threshold) due.push(req);
    }
    // Forget searches that are gone so the map cannot grow without bound.
    for (const key of this.thresholds.keys()) {
      if (!live.has(key)) this.thresholds.delete(key);
    }
    return due;
  }

  /**
   * Persona near the player's target rating, avoiding the last few they faced.
   * `allow` filters out bots that are unavailable (busy or not seeded).
   * `preferredPlaystyle` prioritizes personas matching that playstyle when available.
   */
  pickPersona(
    targetRating: number,
    userId: string,
    allow: (botUserId: string) => boolean = () => true,
    preferredPlaystyle?: string
  ): BotPersona | undefined {
    const recent = new Set(this.recentPersonas.get(userId) ?? []);
    const usable = BOT_PERSONAS.filter((p) => allow(p.userId));
    if (usable.length === 0) return undefined;

    // First pass: if preferredPlaystyle requested, prioritize bots with that style within reasonable rating distance
    if (preferredPlaystyle) {
      for (let band = 120; band <= 600; band += 120) {
        const pool = usable.filter(
          (p) =>
            !recent.has(p.userId) &&
            p.playstyle === preferredPlaystyle &&
            Math.abs(p.targetRating - targetRating) <= band
        );
        if (pool.length > 0) {
          return pool[Math.floor(this.rng() * pool.length)];
        }
      }
    }

    // General pass: nearest rating candidate
    for (let band = 120; band <= 1500; band += 120) {
      const pool = usable.filter(
        (p) => !recent.has(p.userId) && Math.abs(p.targetRating - targetRating) <= band
      );
      if (pool.length > 0) {
        return pool[Math.floor(this.rng() * pool.length)];
      }
    }
    return usable[Math.floor(this.rng() * usable.length)];
  }

  openingFor(
    userId: string,
    gameId: string,
    persona: BotPersona
  ): { id: number; plan: OpeningPlan } {
    return pickOpeningPlan(
      userId,
      gameId,
      persona.playstyle ?? (persona.targetRating >= 1700),
      this.recentOpenings.get(userId) ?? [],
      persona.userId
    );
  }

  remember(userId: string, personaId: string, openingId: number): void {
    const personas = [...(this.recentPersonas.get(userId) ?? []), personaId].slice(-RECENT_PERSONAS);
    this.recentPersonas.set(userId, personas);
    const openings = [...(this.recentOpenings.get(userId) ?? []), openingId].slice(-RECENT_OPENINGS);
    this.recentOpenings.set(userId, openings);
  }
}
