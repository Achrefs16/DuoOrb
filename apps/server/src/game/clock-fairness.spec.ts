import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';
import { createInitialState, getLegalMoves, type GameAction } from '@duoorb/game-core';

/**
 * Clock fairness.
 *
 * The charging rules under test, each of which was previously wrong:
 *
 *  - the mover is charged `arrival - turnStart - their own latency`, not
 *    `downlink + thinking + uplink`;
 *  - a sync reports the clock as the 1 Hz tick derives it, never raw;
 *  - RESIGN is billed to the actor, and an off-turn resign moves nobody's clock;
 *  - the clock starts at the join quorum and never pauses — not even while a
 *    seat is away — and reconnecting credits nothing back.
 */

const MODE = '2p' as const;

function makeGame(svc: AuthoritativeGameService, gameId = 'c1') {
  const state = createInitialState({ mode: MODE, gameId, playerNames: ['A', 'B'] });
  const game = svc.createGame({
    gameId,
    mode: MODE,
    users: [
      { userId: 'uA', displayName: 'A', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      { userId: 'uB', displayName: 'B', rating: { rating: 1500, rd: 350, vol: 0.06 } },
    ],
    timeControlMinutes: 3,
    isRanked: true,
  });
  // Production joins: every clock/AFK test runs post-quorum.
  svc.markSeatJoined(gameId, 'uA');
  svc.markSeatJoined(gameId, 'uB');
  return game ?? (svc.getGame(gameId) as NonNullable<ReturnType<typeof svc.getGame>>);
}

const g = (svc: AuthoritativeGameService, id = 'c1') => svc.getGame(id)!;
const activeOf = (svc: AuthoritativeGameService, id = 'c1') =>
  g(svc, id).state.players[g(svc, id).state.currentPlayerIndex];

function firstMove(svc: AuthoritativeGameService, userId: string, gameId = 'c1') {
  const game = g(svc, gameId);
  const seat = game.state.players.find((p) => game.playerUserIds[p.id] === userId)!;
  return getLegalMoves(game.state, seat.id)[0];
}

/** Completes a move for `userId`; returns false when it was rejected. */
function play(svc: AuthoritativeGameService, userId: string, to?: { row: number; col: number }, gameId = 'c1') {
  const target = to ?? firstMove(svc, userId, gameId);
  return svc.processAction(gameId, userId, { type: 'MOVE', to: target } as GameAction).success;
}

describe('clock charging', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not charge the mover their full round trip', () => {
    makeGame(svc);
    expect(play(svc, 'uA')).toBe(true);
    const afterFirst = g(svc).clocksMs.p1;
    // Arm the turn, then let the clock run. The clock starts on move one.
    expect(g(svc).clockStarted).toBe(true);

    // Teach the server this seat runs a 400ms round trip.
    svc.recordLatency('c1', 'uB', 400);
    svc.recordLatency('c1', 'uB', 400);

    vi.advanceTimersByTime(5000); // 5s of thinking, 400ms of network
    play(svc, 'uB');

    const charged = afterFirst - g(svc).clocksMs.p2;
    // Without the refund this would be the full 5000ms.
    expect(charged).toBeGreaterThan(4000);
    expect(charged).toBeLessThanOrEqual(5000);
    expect(charged).toBeCloseTo(4600, -2);
  });

  it('refunds nothing before a latency sample exists', () => {
    makeGame(svc);
    play(svc, 'uA'); // p2 (uB) is now the seat on turn
    const before = g(svc).clocksMs.p2;
    vi.advanceTimersByTime(3000);
    play(svc, 'uB');
    // Unknown latency must not become free time: the whole 3s is charged
    // against the seat that was on turn.
    expect(before - g(svc).clocksMs.p2).toBeGreaterThan(2000);
  });

  it('clamps an absurd latency sample instead of trusting it', () => {
    makeGame(svc);
    svc.recordLatency('c1', 'uB', 4000);
    expect(g(svc).latencyMs.p2).toBe(4000);
    // A 9s "round trip" is dropped outright.
    svc.recordLatency('c1', 'uB', 9000);
    expect(g(svc).latencyMs.p2).toBe(4000);
  });

  it('keeps the server authoritative: the ledger holds the truth', () => {
    makeGame(svc);
    play(svc, 'uA');
    const snapshot = svc.clockSnapshot(g(svc));
    expect(Object.keys(snapshot).sort()).toEqual(['p1', 'p2']);
    // The seat on turn is derived down; the waiting seat is untouched.
    expect(snapshot.p2).toBeLessThanOrEqual(g(svc).clocksMs.p2);
    expect(snapshot.p1).toBe(g(svc).clocksMs.p1);
  });
});

describe('sync clock freshness', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('never reports more time than the raw ledger holds', () => {
    makeGame(svc);
    play(svc, 'uA');
    const rawActive = g(svc).clocksMs.p2;
    const rawWaiting = g(svc).clocksMs.p1;

    vi.advanceTimersByTime(4000);
    const sync = svc.getSyncState('c1', 0, 'uB');
    expect(sync).not.toBeNull();

    // The active seat is charged for the turn so far...
    expect(sync!.clock.remainingMs.p2).toBeLessThan(rawActive);
    // ...and the waiting seat is exactly what the ledger says.
    expect(sync!.clock.remainingMs.p1).toBe(rawWaiting);
  });

  it('cannot jump upward as the turn runs on', () => {
    makeGame(svc);
    play(svc, 'uA');
    vi.advanceTimersByTime(2000);
    const first = svc.getSyncState('c1', 0, 'uB')!.clock.remainingMs.p2;
    vi.advanceTimersByTime(2000);
    const second = svc.getSyncState('c1', 0, 'uB')!.clock.remainingMs.p2;
    expect(second).toBeLessThan(first);
  });

  it('stamps a server timestamp so the client can correct its own clock', () => {
    makeGame(svc);
    play(svc, 'uA');
    const before = Date.now();
    const sync = svc.getSyncState('c1', 0, 'uB')!;
    expect(sync.clock.serverTimestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('resign attribution', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not deduct the opponent clock for an off-turn resign', () => {
    makeGame(svc);
    play(svc, 'uA'); // now it is p2's turn, and uB is the innocent seat
    const bBefore = g(svc).clocksMs.p2;
    const aBefore = g(svc).clocksMs.p1;

    vi.advanceTimersByTime(6000);
    // uA resigns while it is NOT their turn.
    const res = svc.resign('c1', 'uA');
    expect(res.success).toBe(true);

    // uB held the turn but never resigned: their clock must be untouched.
    expect(g(svc).clocksMs.p2).toBe(bBefore);
    // Only the resigned seat's own clock may have moved, and only by its own
    // (non-running) state — never by the opponent's elapsed time.
    expect(g(svc).clocksMs.p1).toBe(aBefore);
  });

  it('charges the resigning player when it IS their turn', () => {
    makeGame(svc);
    play(svc, 'uA');
    const bBefore = g(svc).clocksMs.p2;
    vi.advanceTimersByTime(3000);
    svc.resign('c1', 'uB');
    // The player who was on turn and resigned pays for the turn they took.
    expect(bBefore - g(svc).clocksMs.p2).toBeGreaterThan(2000);
  });
});

describe('disconnect grace and the clock', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps the clock running while a seat is away — no freeze, no credit', () => {
    makeGame(svc);
    play(svc, 'uA'); // p2 (uB) is on turn
    const atDisconnect = g(svc).clocksMs.p2;

    svc.handleDisconnect('c1', 'uB', () => {});
    // 40s of the 45s window pass. The away seat's clock keeps what the
    // ledger says; the snapshot derives the running turn exactly as live.
    vi.advanceTimersByTime(40_000);
    expect(g(svc).clocksMs.p2).toBe(atDisconnect);
    expect(svc.clockSnapshot(g(svc)).p2).toBeLessThan(atDisconnect);

    // Back inside the window: nothing is credited, nobody is re-stamped.
    // The clock simply carries on from real time.
    svc.handleReconnect('c1', 'uB');
    expect(g(svc).clocksMs.p2).toBe(atDisconnect);
    expect(svc.clockSnapshot(g(svc)).p2).toBeLessThan(atDisconnect);
  });

  it('keeps running even when the AWAY seat was the one on turn', () => {
    makeGame(svc);
    play(svc, 'uA');
    const atDisconnect = g(svc).clocksMs.p2;
    svc.handleDisconnect('c1', 'uB', () => {});
    vi.advanceTimersByTime(20_000);
    expect(svc.clockSnapshot(g(svc)).p2).toBeLessThan(atDisconnect);
  });

  it('forfeits when the grace expires', () => {
    let ended: { reason: string } | null = null;
    makeGame(svc);
    play(svc, 'uA');
    svc.handleDisconnect('c1', 'uB', (e) => {
      ended = e;
    });
    vi.advanceTimersByTime(46_000);
    expect(ended).not.toBeNull();
    expect(ended!.reason).toBe('DISCONNECT');
    expect(g(svc).state.status).toBe('COMPLETED');
  });

  it('starts the clock with the match — the first move is charged, not reset', () => {
    makeGame(svc);
    // 10s of pairing/attaching pass before anyone moves.
    vi.advanceTimersByTime(10_000);
    const before = g(svc).clocksMs.p1;
    expect(play(svc, 'uA')).toBe(true);
    // The opening turn ran from creation, so the mover pays the 10s. The
    // clock never snaps back to full on the first sync.
    expect(before - g(svc).clocksMs.p1).toBeGreaterThanOrEqual(10_000);
    expect(svc.clockSnapshot(g(svc)).p2).toBe(g(svc).clocksMs.p2);
  });
});

describe('inactivity (AFK) is separate from disconnect', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function makeGameWithAfkSpy(gameId = 'c1') {
    const seen: { playerId: string; afkEndsAt: number; secondsRemaining: number }[] = [];
    const state = createInitialState({ mode: MODE, gameId, playerNames: ['A', 'B'] });
    svc.createGame({
      gameId,
      mode: MODE,
      users: [
        { userId: 'uA', displayName: 'A', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'uB', displayName: 'B', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
      onAfkWarning: (_gId, payload) => {
        seen.push(payload);
      },
    });
    // Production joins: the watch only runs post-quorum.
    svc.markSeatJoined(gameId, 'uA');
    svc.markSeatJoined(gameId, 'uB');
    return seen;
  }

  it('forfeits a CONNECTED player who does not move in 45s', () => {
    makeGame(svc);
    play(svc, 'uA'); // uB is on turn and connected
    // The watchdog is armed on the move; nothing has happened yet.
    vi.advanceTimersByTime(44_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');

    vi.advanceTimersByTime(2_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    // The absent seat keeps its own outcome; idling is its own reason.
    expect(g(svc).state.winnerId).toBe('p1');
  });

  it('watches the OPENING turn too — a player who never moves is still warned and forfeited', () => {
    const seen = makeGameWithAfkSpy();
    // No moves at all: nothing surfaces for the first 15s of stillness.
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(15_000);
    // Then the warning lands with the true deadline (30s shown, 45s allowance).
    expect(seen).toHaveLength(1);
    expect(seen[0].playerId).toBe('p1');
    expect(seen[0].afkEndsAt).toBe(Date.now() + 30_000);

    vi.advanceTimersByTime(29_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');
    vi.advanceTimersByTime(2_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    expect(g(svc).state.winnerId).toBe('p2');
  });

  it('warns after 15s of stillness, once per turn', () => {
    const seen = makeGameWithAfkSpy();
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(15_000);
    expect(seen).toHaveLength(1);
    expect(seen[0].afkEndsAt).toBe(Date.now() + 30_000);

    // The next turn warns again, for the new holder — never twice for one.
    // A move inside the delay warns nobody and leaves nothing stale behind.
    play(svc, 'uA');
    expect(seen).toHaveLength(1);
    vi.advanceTimersByTime(15_000);
    expect(seen).toHaveLength(2);
    expect(seen[1].playerId).toBe('p2');
    expect(seen[1].afkEndsAt).toBe(Date.now() + 30_000);
  });

  it('a turn that ends inside the delay warns nobody', () => {
    const seen = makeGameWithAfkSpy();
    vi.advanceTimersByTime(10_000);
    play(svc, 'uA'); // turn passes at t10: the notice dies unheard
    vi.advanceTimersByTime(10_000); // t20: only 10s into the new turn
    expect(seen).toHaveLength(0);
    vi.advanceTimersByTime(6_000); // t26: 16s into uB's turn
    expect(seen).toHaveLength(1);
    expect(seen[0].playerId).toBe('p2');
  });

  it('hides the deadline from sync until the notice delay elapses', () => {
    makeGameWithAfkSpy();
    vi.advanceTimersByTime(10_000);
    // Early attachers see nothing — same rule as the broadcast.
    expect(svc.getSyncState('c1', 0, 'uA')!.afk).toBeNull();
    vi.advanceTimersByTime(10_000); // t20: 25s remain
    const sync = svc.getSyncState('c1', 0, 'uA')!;
    expect(sync.afk).toEqual({ playerId: 'p1', afkEndsAt: expect.any(Number) });
    expect(sync.afk!.afkEndsAt).toBeLessThanOrEqual(Date.now() + 25_000);
    expect(sync.afk!.afkEndsAt).toBeGreaterThan(Date.now() + 24_000);
  });

  it('re-arms for a returnee back on turn — coming back does not disarm idling', () => {
    makeGame(svc);
    play(svc, 'uA'); // uB on turn
    svc.handleDisconnect('c1', 'uB', () => {});
    svc.handleReconnect('c1', 'uB');
    // The original 45s deadline died with the disconnect; the new one runs
    // from the return. Past the old deadline, still live...
    vi.advanceTimersByTime(44_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');
    // ...and past the new one, forfeited for idling, not absence.
    vi.advanceTimersByTime(2_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    expect(g(svc).state.winnerId).toBe('p1');
  });

  it('does not fire while the seat is inside a disconnect grace window', () => {
    makeGame(svc);
    play(svc, 'uA');
    // uB walks away: the grace timer owns the outcome, not the AFK watchdog.
    svc.handleDisconnect('c1', 'uB', () => {});
    vi.advanceTimersByTime(50_000);
    // Only one forfeit happened, from the grace timer (which ended the game).
    expect(g(svc).state.status).toBe('COMPLETED');
  });

  it('clears the watchdog when the player moves in time', () => {
    makeGame(svc);
    play(svc, 'uA');
    vi.advanceTimersByTime(30_000);
    expect(play(svc, 'uB')).toBe(true);
    // A fresh 45s runs from the move: the game is still live because uB moved.
    vi.advanceTimersByTime(40_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');
  });
});

describe('join quorum + flag hardening (F4)', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('a move after the deadline is a TIMEOUT loss even if no tick ran (C1-timing)', () => {
    makeGame(svc); // quorum at t0, uA to move, 180s clock
    // Jump past the deadline WITHOUT running any timer: the 1s tick and the
    // one-shot flag never fire. The old code accepted this move (with
    // increment); now it converts to a flag.
    vi.setSystemTime(Date.now() + 181_000);
    const res = svc.processAction('c1', 'uA', { type: 'MOVE', to: firstMove(svc, 'uA') } as GameAction);
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.recorded.action.type).toBe('TIMEOUT');
    expect(res.ended?.reason).toBe('TIMEOUT');
    expect(g(svc).state.status).toBe('COMPLETED');
    expect(g(svc).state.winnerId).toBe('p2');
  });

  it('grace expiry bills the holder for the window — no free 45s (C5-timing)', () => {
    makeGame(svc);
    play(svc, 'uA'); // uB to move; then uA (off-turn) drops
    svc.handleDisconnect('c1', 'uA', () => {});
    vi.advanceTimersByTime(46_000); // grace expires: uA forfeits, uB wins
    expect(g(svc).state.status).toBe('COMPLETED');
    // uB held the turn through the whole window: billed the 45s to expiry.
    expect(g(svc).clocksMs['p2']).toBe(180_000 - 45_000);
    // uA paid only their own t0 move (~0ms), nothing for the absence.
    expect(g(svc).clocksMs['p1']).toBe(180_000);
  });

  it('an on-turn leaver runs their own clock to forfeit (C5-timing)', () => {
    makeGame(svc);
    // uA holds the turn and drops without moving.
    svc.handleDisconnect('c1', 'uA', () => {});
    vi.advanceTimersByTime(46_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    expect(g(svc).state.winnerId).toBe('p2');
    // The leaver's clock ran the window instead of freezing at disconnect.
    expect(g(svc).clocksMs['p1']).toBe(180_000 - 45_000);
  });

  it('pre-quorum turns are unbilled and unwatched (M1-timing)', () => {
    svc.createGame({
      gameId: 'c9',
      mode: MODE,
      users: [
        { userId: 'uA', displayName: 'A', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'uB', displayName: 'B', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    const game = svc.getGame('c9')!;
    expect(game.clockStarted).toBe(false);
    // Past the AFK allowance with no joins: still live, clock parked.
    vi.advanceTimersByTime(60_000);
    expect(game.state.status).toBe('IN_PROGRESS');
    expect(svc.clockSnapshot(game)['p1']).toBe(180_000);
    // A pre-quorum move is accepted but bills nothing...
    expect(play(svc, 'uA', undefined, 'c9')).toBe(true);
    expect(svc.getGame('c9')!.clocksMs['p1']).toBe(180_000);
    // ...and the quorum starts the clock from NOW with full time.
    expect(svc.markSeatJoined('c9', 'uA')).toBe(false); // one seat: not yet
    expect(svc.markSeatJoined('c9', 'uB')).toBe(true);
    expect(svc.markSeatJoined('c9', 'uNobody')).toBe(false);
    vi.advanceTimersByTime(10_000);
    // Turn is uB's after uA's pre-quorum move: uB derived, uA ledger-intact.
    expect(svc.clockSnapshot(svc.getGame('c9')!)['p2']).toBe(170_000);
    expect(svc.getGame('c9')!.clocksMs['p1']).toBe(180_000);
  });

  it('quorum timeout puts no-show seats on standard grace and reports them (M1-timing)', () => {    svc.createGame({
      gameId: 'cQ',
      mode: MODE,
      users: [
        { userId: 'uA', displayName: 'A', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'uB', displayName: 'B', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    svc.markSeatJoined('cQ', 'uA'); // only A shows up
    const game = svc.getGame('cQ')!;
    const missing: { userId: string; gracePeriodSeconds: number }[] = [];
    game.onQuorumExpired = (_gId, m) => missing.push(...m);
    vi.advanceTimersByTime(91_000);
    // uB never joined: standard 45s grace armed, gateway notified.
    expect(game.disconnectedUsers['uB']).toBeTruthy();
    expect(game.disconnectedUsers['uA']).toBeUndefined();
    expect(missing).toHaveLength(1);
    expect(missing[0].userId).toBe('uB');
    expect(missing[0].gracePeriodSeconds).toBe(45);
    // ...and the grace still forfeits if they never come.
    vi.advanceTimersByTime(46_000);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1');
  });
});

describe('refund unity + AFK carry (F5)', () => {
  let svc: AuthoritativeGameService;

  beforeEach(() => {
    vi.useFakeTimers();
    svc = new AuthoritativeGameService(undefined as any);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('flag, snapshot, and charge share one refunded deadline (C4-timing)', () => {
    makeGame(svc); // quorum at t0, uA to move, 180s clock
    const game = g(svc);
    game.clocksMs['p1'] = 3_000;
    // A 5000ms probe smooths to exactly 5000 (first sample), refunded at the
    // 1200ms cap: raw deadline 3.0s, refunded deadline 4.2s.
    svc.recordLatency('c1', 'uA', 5_000);
    vi.advanceTimersByTime(3_500);
    // Past the RAW deadline but inside the refunded one: the tick did not
    // flag (old code flagged here), and the display agrees with the charge.
    expect(game.state.status).toBe('IN_PROGRESS');
    expect(svc.clockSnapshot(game)['p1']).toBe(700);
    const res = svc.processAction('c1', 'uA', { type: 'MOVE', to: firstMove(svc, 'uA') } as GameAction);
    expect(res.success).toBe(true);
    // Charged exactly to the shared deadline: 3000 - (3500 - 1200).
    expect(game.clocksMs['p1']).toBe(700);
  });

  it('flags past the refunded deadline, not the raw one (C4-timing)', () => {
    makeGame(svc);
    const game = g(svc);
    game.clocksMs['p1'] = 3_000;
    svc.recordLatency('c1', 'uA', 5_000); // refund 1200ms → deadline 4.2s
    vi.advanceTimersByTime(5_000);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p2');
  });

  it('a grace interruption banks the AFK remainder instead of resetting it', () => {    makeGame(svc); // quorum at t0, AFK armed for uA's turn
    vi.advanceTimersByTime(40_000); // 5s of allowance left
    svc.handleDisconnect('c1', 'uB', () => {}); // unrelated seat drops
    vi.advanceTimersByTime(2_000);
    expect(svc.cancelDisconnectGrace('c1', 'uB')).toBe(true); // uB back fast
    // 3s of banked allowance left — NOT a fresh 45s: still live...
    vi.advanceTimersByTime(2_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');
    // ...then forfeited for idling past it (deadline was t47).
    vi.advanceTimersByTime(4_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    expect(g(svc).state.winnerId).toBe('p2');
  });

  it('defers the flag while a seat is away — absence wins the reason (M19)', () => {
    makeGame(svc); // quorum at t0, uA to move, 180s clock
    const game = g(svc);
    game.clocksMs['p1'] = 5_000; // holder nearly spent
    const reasons: (string | undefined)[] = [];
    svc.handleDisconnect('c1', 'uB', (ended) => {
      reasons.push(ended?.reason);
    });
    // Past the 5s clock but inside the 45s grace: no TIMEOUT steal.
    vi.advanceTimersByTime(6_000);
    expect(game.state.status).toBe('IN_PROGRESS');
    // Grace expires: uB forfeits, uA wins — recorded as absence.
    vi.advanceTimersByTime(40_000);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1');
    expect(reasons).toEqual(['DISCONNECT']);
  });
});