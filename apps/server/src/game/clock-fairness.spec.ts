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
 *  - the clock pauses while a seat is inside its reconnect grace.
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

  it('does not run the clock while a seat is away, and gives the time back', () => {
    makeGame(svc);
    play(svc, 'uA'); // p2 (uB) is on turn
    const atDisconnect = g(svc).clocksMs.p2;

    svc.handleDisconnect('c1', 'uB', () => {});
    expect(g(svc).clockPausedAt).not.toBeNull();

    // 40s of the 45s window pass. uB is not on their phone; uA must not pay.
    vi.advanceTimersByTime(40_000);
    expect(g(svc).clocksMs.p2).toBe(atDisconnect);
    expect(svc.clockSnapshot(g(svc)).p2).toBe(atDisconnect);

    // Back inside the window: the clock resumes and the frozen time returns.
    svc.handleReconnect('c1', 'uB');
    expect(g(svc).clockPausedAt).toBeNull();
    expect(g(svc).clocksMs.p2).toBeGreaterThanOrEqual(atDisconnect + 39_000);
  });

  it('pauses even when the AWAY seat was the one on turn', () => {
    makeGame(svc);
    play(svc, 'uA');
    const atDisconnect = g(svc).clocksMs.p2;
    svc.handleDisconnect('c1', 'uB', () => {});
    vi.advanceTimersByTime(20_000);
    expect(g(svc).clocksMs.p2).toBe(atDisconnect);
  });

  it('releases the pause when the grace expires rather than crediting it back', () => {
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

  it('forfeits a CONNECTED player who does not move in 60s', () => {
    makeGame(svc);
    play(svc, 'uA'); // uB is on turn and connected
    // The watchdog is armed on the move; nothing has happened yet.
    vi.advanceTimersByTime(59_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');

    vi.advanceTimersByTime(2_000);
    expect(g(svc).state.status).toBe('COMPLETED');
    // The absent seat keeps its own outcome; idling is its own reason.
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
    // Well past the original limit: the game is still live because uB moved.
    vi.advanceTimersByTime(40_000);
    expect(g(svc).state.status).toBe('IN_PROGRESS');
  });
});