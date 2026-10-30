import { describe, it, expect, vi, afterEach } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';
import {
  DEFAULT_INITIAL_RATING,
  DEFAULT_INITIAL_RD,
  DEFAULT_INITIAL_VOL,
  PROVISIONAL_MAX_LOSS,
} from '../rating/glicko2.service.js';

afterEach(() => {
  vi.useRealTimers();
});

function make1v1Game(
  svc: AuthoritativeGameService,
  gid: string,
  p1Rating: { rating: number; rd: number; vol: number; gamesPlayed?: number },
  p2Rating: { rating: number; rd: number; vol: number; gamesPlayed?: number }
) {
  const users = [
    { userId: 'u1', displayName: 'Player 1', rating: { ...p1Rating } },
    { userId: 'u2', displayName: 'Player 2', rating: { ...p2Rating } },
  ];
  return svc.createGame({
    gameId: gid,
    mode: '2p',
    users,
    timeControlMinutes: 3,
    isRanked: true,
  });
}

describe('provisional early-match rating protection', () => {
  it('cushions rating loss to max PROVISIONAL_MAX_LOSS for first matches', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const game = make1v1Game(
      svc,
      'prov-test-1',
      { rating: DEFAULT_INITIAL_RATING, rd: DEFAULT_INITIAL_RD, vol: DEFAULT_INITIAL_VOL, gamesPlayed: 0 },
      { rating: 1500, rd: 80, vol: 0.06, gamesPlayed: 30 }
    );

    // Player 1 resigns (u1 loses)
    svc.resign('prov-test-1', 'u1');
    const pc = game.pendingCompletion!;
    expect(pc).toBeDefined();

    const u1Change = pc.ratingChanges['u1'];
    expect(u1Change).toBeDefined();
    // Loss must be capped to -PROVISIONAL_MAX_LOSS (-45) instead of -72 to -175
    expect(u1Change.delta).toBe(-PROVISIONAL_MAX_LOSS);
    expect(u1Change.after).toBe(DEFAULT_INITIAL_RATING - PROVISIONAL_MAX_LOSS);
  });

  it('limits total rating drop over first two consecutive losses to at most 90 points (not ~300)', () => {
    const svc = new AuthoritativeGameService(undefined as any);

    // Match 1: fresh player loses
    const g1 = make1v1Game(
      svc,
      'prov-match-1',
      { rating: 1500, rd: DEFAULT_INITIAL_RD, vol: 0.06, gamesPlayed: 0 },
      { rating: 1500, rd: 80, vol: 0.06, gamesPlayed: 40 }
    );
    svc.resign('prov-match-1', 'u1');
    const m1Delta = g1.pendingCompletion!.ratingChanges['u1'].delta;
    const m1After = g1.pendingCompletion!.ratingChanges['u1'].after;

    expect(m1Delta).toBe(-PROVISIONAL_MAX_LOSS);
    expect(m1After).toBe(1455);

    // Match 2: same player with 1 game played loses again to equal rating opponent
    const g2 = make1v1Game(
      svc,
      'prov-match-2',
      { rating: m1After, rd: DEFAULT_INITIAL_RD, vol: 0.06, gamesPlayed: 1 },
      { rating: m1After, rd: 80, vol: 0.06, gamesPlayed: 25 }
    );
    svc.resign('prov-match-2', 'u1');
    const m2Delta = g2.pendingCompletion!.ratingChanges['u1'].delta;
    const m2After = g2.pendingCompletion!.ratingChanges['u1'].after;

    expect(m2Delta).toBe(-PROVISIONAL_MAX_LOSS);
    expect(m2After).toBe(1410);

    const totalDrop = 1500 - m2After;
    expect(totalDrop).toBe(90);
    expect(totalDrop).toBeLessThanOrEqual(90);
  });

  it('allows full rating gain on early wins (not capped)', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const game = make1v1Game(
      svc,
      'prov-win-1',
      { rating: 1500, rd: DEFAULT_INITIAL_RD, vol: 0.06, gamesPlayed: 0 },
      { rating: 1500, rd: 80, vol: 0.06, gamesPlayed: 30 }
    );

    // Player 2 resigns (u1 wins)
    svc.resign('prov-win-1', 'u2');
    const pc = game.pendingCompletion!;
    const u1Change = pc.ratingChanges['u1'];

    // u1 win gain is uncapped and significantly higher than 45
    expect(u1Change.delta).toBeGreaterThan(45);
  });

  it('does NOT apply the provisional loss cap to established players (gamesPlayed >= 5)', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    // Established player with gamesPlayed = 10, but high RD (e.g. returning after absence)
    const game = make1v1Game(
      svc,
      'estab-test-1',
      { rating: 1500, rd: 220, vol: 0.06, gamesPlayed: 10 },
      { rating: 1500, rd: 80, vol: 0.06, gamesPlayed: 50 }
    );

    svc.resign('estab-test-1', 'u1');
    const pc = game.pendingCompletion!;
    const u1Change = pc.ratingChanges['u1'];

    // Because gamesPlayed >= 5, raw Glicko delta (-97) is applied without provisional capping
    expect(u1Change.delta).toBeLessThan(-PROVISIONAL_MAX_LOSS);
  });

  it('produces zero rating changes for unranked games (isRanked: false)', () => {
    const svc = new AuthoritativeGameService(undefined as any);
    const users = [
      { userId: 'u1', displayName: 'P1', rating: { rating: 1500, rd: 180, vol: 0.06, gamesPlayed: 0 } },
      { userId: 'u2', displayName: 'P2', rating: { rating: 1500, rd: 180, vol: 0.06, gamesPlayed: 0 } },
    ];
    const game = svc.createGame({
      gameId: 'unranked-test-1',
      mode: '2p',
      users,
      timeControlMinutes: 3,
      isRanked: false,
    });

    const ended = svc.resign('unranked-test-1', 'u1');
    expect(ended.success).toBe(true);
    expect(game.isRanked).toBe(false);
    expect(game.pendingCompletion!.ratingChanges).toEqual({});
    if (ended.success && ended.ended) {
      expect(ended.ended.isRanked).toBe(false);
      expect(ended.ended.ratingChanges).toEqual({});
    }
  });
});
