import { describe, expect, it } from 'vitest';
import { BotBackfillService, loadBackfillConfig } from './bot-backfill.service.js';
import type { MatchmakingRequest } from '../matchmaking/matchmaking.service.js';
import { BOT_PERSONAS } from './bot-roster.js';

describe('BotBackfillService', () => {
  const config = {
    enabled: true,
    percent: 100,
    minWaitMs: 8000,
    maxWaitMs: 12000,
  };

  it('correctly detects eligible 1v1 pool requests', () => {
    const service = new BotBackfillService(config);
    const valid: MatchmakingRequest = {
      userId: 'u1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      incrementSeconds: 0,
      wallsEach: 10,
      joinedAt: 1000,
      rd: 50,
      vol: 0.06,
    };
    expect(service.isQuickPool(valid)).toBe(true);

    expect(service.isQuickPool({ ...valid, mode: '4p' })).toBe(false);
    expect(service.isQuickPool({ ...valid, timeControlMinutes: 5 })).toBe(true);
    expect(service.isQuickPool({ ...valid, incrementSeconds: 2 })).toBe(true);
    expect(service.isQuickPool({ ...valid, wallsEach: 5 })).toBe(true);
  });

  it('dueEntries only triggers after the wait threshold is reached', () => {
    // Deterministic random generating mid-point wait
    const service = new BotBackfillService(config, () => 0.5);
    const req: MatchmakingRequest = {
      userId: 'u1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      incrementSeconds: 0,
      wallsEach: 10,
      joinedAt: 10000,
      rd: 50,
      vol: 0.06,
    };

    // At joinedAt + 5s (15000), not yet due (minWait is 8s)
    expect(service.dueEntries([req], 15000)).toHaveLength(0);

    // Midpoint wait = 8000 + 0.5 * 4000 = 10000ms.
    // At joinedAt + 10s (20000), it becomes due.
    expect(service.dueEntries([req], 20000)).toHaveLength(1);
  });

  it('dueEntries returns empty if backfill is disabled', () => {
    const service = new BotBackfillService({ ...config, enabled: false });
    const req: MatchmakingRequest = {
      userId: 'u1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      incrementSeconds: 0,
      wallsEach: 10,
      joinedAt: 10000,
      rd: 50,
      vol: 0.06,
    };
    expect(service.dueEntries([req], 100000)).toHaveLength(0);
  });

  it('pickPersona selects persona near human rating and remembers history', () => {
    const service = new BotBackfillService(config);
    const persona = service.pickPersona(1500, 'u1');
    expect(persona).toBeDefined();
    if (!persona) return;

    expect(persona.targetRating).toBeGreaterThanOrEqual(1300);
    expect(persona.targetRating).toBeLessThanOrEqual(1700);

    // Remember persona
    service.remember('u1', persona.userId, 1);

    // Pick again - service prefers personas not recently faced
    const persona2 = service.pickPersona(1500, 'u1');
    expect(persona2).toBeDefined();
  });

  it('loadBackfillConfig parses environment variables properly', () => {
    const defaults = loadBackfillConfig({});
    expect(defaults.enabled).toBe(true);
    expect(defaults.percent).toBe(100);
    expect(defaults.minWaitMs).toBe(5000);
    expect(defaults.maxWaitMs).toBe(20000);

    const parsed = loadBackfillConfig({
      BOT_BACKFILL_ENABLED: 'true',
      BOT_BACKFILL_PERCENT: '50',
      BOT_BACKFILL_MIN_WAIT_MS: '9000',
      BOT_BACKFILL_MAX_WAIT_MS: '15000',
    });
    expect(parsed.enabled).toBe(true);
    expect(parsed.percent).toBe(50);
    expect(parsed.minWaitMs).toBe(9000);
    expect(parsed.maxWaitMs).toBe(15000);
  });
});

