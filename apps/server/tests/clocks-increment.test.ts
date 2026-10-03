import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthoritativeGameService } from '../src/game/authoritative-game.service.js';
import { getLegalMoves } from '@duoorb/game-core';

const RATING = { rating: 1500, rd: 350, vol: 0.06 };

function makeGame(service: AuthoritativeGameService, gameId: string, minutes: number, increment: number) {
  return service.createGame({
    gameId,
    mode: '2p',
    users: [
      { userId: 'p1', displayName: 'Alice', rating: RATING },
      { userId: 'p2', displayName: 'Bob', rating: RATING },
    ],
    timeControlMinutes: minutes,
    incrementSeconds: increment,
    isRanked: true,
  });
}

describe('Clocks and Fischer Increment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the clock from the join quorum — the opening turn is charged, not reset', () => {
    const service = new AuthoritativeGameService();
    const game = makeGame(service, 'armed-test', 3, 2);

    // Pre-quorum the clock is parked: pairing + join latency bills nobody,
    // and no watchdog runs — the opening turn cannot forfeit a player whose
    // opponent simply never joined.
    expect(game.clockStarted).toBe(false);
    vi.advanceTimersByTime(10000);
    expect(service.clockSnapshot(game)['p1']).toBe(180000);

    // Both seats join: the countdown starts from NOW with full time, so the
    // first sync can never snap the clock back to full time either.
    service.markSeatJoined('armed-test', 'p1');
    service.markSeatJoined('armed-test', 'p2');
    expect(game.clockStarted).toBe(true);

    // 10s pass before anyone moves: the opener's turn is already running.
    // The ledger only moves on moves, but the snapshot derives the turn.
    vi.advanceTimersByTime(10000);
    expect(game.clocksMs['p1']).toBe(180000);
    expect(service.clockSnapshot(game)['p1']).toBe(170000);

    // ...and idling through the whole allowance forfeits, even with no moves
    // at all: the opening turn is watched like every later one.
    vi.advanceTimersByTime(36000);
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p2');
  });

  it('credits Fischer increment after each accepted move, charging since the join quorum', () => {
    const service = new AuthoritativeGameService();
    const game = makeGame(service, 'clock-inc-test', 3, 2);
    service.markSeatJoined('clock-inc-test', 'p1');
    service.markSeatJoined('clock-inc-test', 'p2');

    expect(game.clocksMs['p1']).toBe(180000);
    expect(game.clocksMs['p2']).toBe(180000);

    // 5s pass before anyone moves — charged to the opener, then +2s increment.
    vi.advanceTimersByTime(5000);

    const res1 = service.processAction('clock-inc-test', 'p1', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });

    expect(res1.success).toBe(true);
    expect(game.clockStarted).toBe(true);
    expect(game.clocksMs['p1']).toBe(180000 - 5000 + 2000);
    // Bob's clock was untouched.
    expect(game.clocksMs['p2']).toBe(180000);

    // Subsequent moves are charged normally: 4s of thinking, then +2s.
    vi.advanceTimersByTime(4000);
    const res2 = service.processAction('clock-inc-test', 'p2', {
      type: 'MOVE',
      to: { row: 1, col: 4 },
    });

    expect(res2.success).toBe(true);
    expect(game.clocksMs['p2']).toBe(180000 - 4000 + 2000);
    expect(game.clocksMs['p1']).toBe(180000 - 5000 + 2000);
  });

  it('an idle player forfeits by AFK before their clock runs out', () => {
    let timeoutFired = false;
    let endedReason: string | undefined;

    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'timeout-test',
      mode: '2p',
      users: [
        { userId: 'p1', displayName: 'Alice', rating: RATING },
        { userId: 'p2', displayName: 'Bob', rating: RATING },
      ],
      timeControlMinutes: 1, // 60,000 ms
      incrementSeconds: 0,
      isRanked: true,
      onTimeout: (_gId, ended) => {
        timeoutFired = true;
        endedReason = ended.reason;
      },
    });
    service.markSeatJoined('timeout-test', 'p1');
    service.markSeatJoined('timeout-test', 'p2');

    expect(game.state.status).toBe('IN_PROGRESS');

    // Alice opens immediately, leaving Bob on the move. Bob then sits: the
    // 45s inactivity limit fires before his 60s clock runs out, so the
    // reason is AFK — idling — not TIMEOUT.
    const opening = service.processAction('timeout-test', 'p1', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });
    expect(opening.success).toBe(true);

    vi.advanceTimersByTime(61000);

    expect(timeoutFired).toBe(true);
    expect(endedReason).toBe('AFK');
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1'); // Alice wins by Bob's idling
  });

  it('times out a clock that is actually spent, while both sides keep moving', () => {
    let timeoutFired = false;
    let endedReason: string | undefined;

    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'timeout-active',
      mode: '2p',
      users: [
        { userId: 'p1', displayName: 'Alice', rating: RATING },
        { userId: 'p2', displayName: 'Bob', rating: RATING },
      ],
      timeControlMinutes: 1, // 60,000 ms
      incrementSeconds: 0,
      isRanked: true,
      onTimeout: (_gId, ended) => {
        timeoutFired = true;
        endedReason = ended.reason;
      },
    });
    service.markSeatJoined('timeout-active', 'p1');
    service.markSeatJoined('timeout-active', 'p2');

    // First legal move for whoever holds the turn right now.
    const moveFor = (userId: string) => {
      const g = service.getGame('timeout-active')!;
      const seat = g.userPlayerIds[userId];
      const to = getLegalMoves(g.state, seat)[0];
      return service.processAction('timeout-active', userId, { type: 'MOVE', to });
    };

    // Both sides move inside every 45s allowance, so no AFK watchdog ever
    // fires — but Bob's 60s clock still runs out on his second turn.
    expect(moveFor('p1').success).toBe(true); // t0
    vi.advanceTimersByTime(30_000);
    expect(moveFor('p2').success).toBe(true); // t30: Bob spent 30s, 30s left
    vi.advanceTimersByTime(20_000);
    expect(moveFor('p1').success).toBe(true); // t50: Alice spent 20s, 40s left
    vi.advanceTimersByTime(31_000); // t81: Bob's remaining 30s ran out at t80

    expect(timeoutFired).toBe(true);
    expect(endedReason).toBe('TIMEOUT');
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1'); // Alice wins by Bob's timeout
  });
});
