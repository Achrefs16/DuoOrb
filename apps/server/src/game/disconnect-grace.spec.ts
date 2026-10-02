import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthoritativeGameService, type ActiveOnlineGame } from './authoritative-game.service.js';
import { createInitialState, type GameMode } from '@duoorb/game-core';

/**
 * Disconnect grace: the timer that decides whether an absent player forfeits.
 *
 * These are the regressions that made a normal reconnect cost the player
 * their own game — the cases the gateway spec cannot see because they live
 * entirely inside the service's timer bookkeeping.
 */

const MODE: GameMode = '2p';

function makeGame(svc: AuthoritativeGameService, gameId = 'g1', userIds = ['uA', 'uB']) {
  const state = createInitialState({
    mode: MODE,
    gameId,
    playerNames: ['A', 'B'],
  });
  const game: ActiveOnlineGame = {
    id: gameId,
    state,
    mode: MODE,
    playerUserIds: { p1: userIds[0], p2: userIds[1] },
    userPlayerIds: { [userIds[0]]: 'p1', [userIds[1]]: 'p2' },
    ratings: {},
    clocksMs: { p1: 60_000, p2: 60_000 },
    incrementSeconds: 0,
    turnStartTimestamp: Date.now(),
    clockStarted: true,
    disconnectedUsers: {},
    disconnectGenerations: {},
    latencyMs: {},
    disconnectGraceEndsAt: {},
    clockPausedAt: null,
    afkTimers: new Map(),
    afkWarningAt: null,
    rematchOffers: new Set<string>(),
    isRanked: true,
    timeControlMinutes: 3,
    wallsEach: 10,
    seenActions: new Map(),
    pendingMoves: [],
    leftUserIds: new Set<string>(),
  };
  (svc as any).games.set(gameId, game);
  return game;
}

describe('disconnect grace', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('arms a timer and reports the seat and the server deadline', () => {
    const game = makeGame(svc);
    const before = Date.now();
    const res = svc.handleDisconnect('g1', 'uA', () => {});
    // 45s for every game: ranked and casual alike.
    expect(res?.gracePeriodSeconds).toBe(45);
    expect(res?.playerId).toBe('p1');
    expect(res?.graceEndsAt).toBeGreaterThanOrEqual(before + 45_000);
    expect(game.disconnectedUsers.uA).toBeTruthy();
    expect(game.disconnectGraceEndsAt.uA).toBe(res?.graceEndsAt);
  });

  it('a reconnect cancels the grace timer — no forfeit', () => {
    const game = makeGame(svc);
    const onForfeit = vi.fn();
    svc.handleDisconnect('g1', 'uA', onForfeit);
    svc.handleReconnect('g1', 'uA');
    vi.advanceTimersByTime(120_000);
    expect(onForfeit).not.toHaveBeenCalled();
    expect(game.disconnectedUsers.uA).toBeUndefined();
    expect(game.state.status).toBe('IN_PROGRESS');
  });

  it('cancelDisconnectGrace is enough on its own (reconnect cancels before it awaits)', () => {
    const game = makeGame(svc);
    const onForfeit = vi.fn();
    svc.handleDisconnect('g1', 'uA', onForfeit);
    // Exactly what game:join does now: kill the timer first, answer later.
    expect(svc.cancelDisconnectGrace('g1', 'uA')).toBe(true);
    expect(svc.cancelDisconnectGrace('g1', 'uA')).toBe(false);
    vi.advanceTimersByTime(120_000);
    expect(onForfeit).not.toHaveBeenCalled();
    expect(game.state.status).toBe('IN_PROGRESS');
  });

  it('a SECOND disconnect replaces the timer instead of stacking an orphan on it', () => {
    const game = makeGame(svc);
    const onForfeit = vi.fn();
    svc.handleDisconnect('g1', 'uA', onForfeit);
    const firstTimer = game.disconnectedUsers.uA.timeoutId;
    svc.handleDisconnect('g1', 'uA', onForfeit);
    const secondTimer = game.disconnectedUsers.uA.timeoutId;

    // One live entry only — the orphan is exactly what used to forfeit a
    // player who had already come back.
    expect(secondTimer).not.toBe(firstTimer);
    expect(Object.keys(game.disconnectedUsers)).toEqual(['uA']);

    // Even if the orphaned callback were still delivered, it must not act.
    expect(game.disconnectGenerations.uA).toBe(1);
  });

  it('an orphaned callback cannot delete the live entry or forfeit', () => {
    const game = makeGame(svc);
    const onForfeit = vi.fn();
    svc.handleDisconnect('g1', 'uA', onForfeit);
    svc.cancelDisconnectGrace('g1', 'uA'); // e.g. player returns
    svc.handleDisconnect('g1', 'uA', onForfeit); // ...then drops again

    // Fire every timer that was ever armed, including the retired ones.
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(120_000);

    // The live timer must have run (it was armed and left alone), and the
    // state it produced must be a real forfeit of the absent player — not a
    // deletion of somebody else's bookkeeping.
    expect(game.state.status).not.toBe('IN_PROGRESS');
    expect(onForfeit).toHaveBeenCalledTimes(1);
  });

  it('forfeits the absent player when nobody returns', () => {
    const game = makeGame(svc);
    const onForfeit = vi.fn();
    svc.handleDisconnect('g1', 'uA', onForfeit);
    vi.advanceTimersByTime(46_000);
    expect(onForfeit).toHaveBeenCalledTimes(1);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p2');
  });

  it('a finished player never arms a timer', () => {
    const game = makeGame(svc);
    // Seat already banked its placement (they reached their goal earlier):
    // losing the socket now must not cost them anything.
    const seatNow = game.state.players.find((p) => p.id === 'p1')!;
    game.state = {
      ...game.state,
      players: game.state.players.map((p) =>
        p.id === 'p1' ? { ...seatNow, status: 'FINISHED' as const, place: 1 } : p
      ),
    };
    expect(svc.handleDisconnect('g1', 'uA', () => {})).toBeNull();
    expect(game.disconnectedUsers.uA).toBeUndefined();
  });
});