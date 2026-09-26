import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthoritativeGameService } from '../src/game/authoritative-game.service.js';

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

  it('does not run the clock until the first move is played', () => {
    const service = new AuthoritativeGameService();
    const game = makeGame(service, 'armed-test', 3, 2);

    expect(game.clocksMs['p1']).toBe(180000);
    expect(game.clocksMs['p2']).toBe(180000);
    expect(game.clockStarted).toBe(false);

    // Pairing, attaching and rendering all happen before anyone can move.
    // That latency must not be charged to either player: a client that failed
    // to attach at all used to time out and forfeit a game it never saw.
    vi.advanceTimersByTime(60000);

    expect(game.clocksMs['p1']).toBe(180000);
    expect(game.clocksMs['p2']).toBe(180000);
    expect(game.state.status).toBe('IN_PROGRESS');
    expect(game.clockStarted).toBe(false);
  });

  it('credits Fischer increment after each accepted move, charging only time since arming', () => {
    const service = new AuthoritativeGameService();
    const game = makeGame(service, 'clock-inc-test', 3, 2);

    expect(game.clocksMs['p1']).toBe(180000);
    expect(game.clocksMs['p2']).toBe(180000);

    // Time passes before anyone moves — not charged to anybody.
    vi.advanceTimersByTime(5000);

    // Alice's first move arms the clock, so this move costs 0ms of her time
    // and then banks the 2s increment.
    const res1 = service.processAction('clock-inc-test', 'p1', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });

    expect(res1.success).toBe(true);
    expect(game.clockStarted).toBe(true);
    expect(game.clocksMs['p1']).toBe(182000);
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
    expect(game.clocksMs['p1']).toBe(182000);
  });

  it('triggers timeout and flags game when clock hits zero', () => {
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

    expect(game.state.status).toBe('IN_PROGRESS');

    // Arm the clock with Alice's opening move (she holds the first turn),
    // which leaves Bob on the move. Bob then sits and runs his clock down.
    const opening = service.processAction('timeout-test', 'p1', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });
    expect(opening.success).toBe(true);
    expect(game.clockStarted).toBe(true);

    // Advance past 60 seconds of total budget.
    vi.advanceTimersByTime(61000);

    expect(timeoutFired).toBe(true);
    expect(endedReason).toBe('TIMEOUT');
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p1'); // Alice wins by Bob's timeout
  });
});
