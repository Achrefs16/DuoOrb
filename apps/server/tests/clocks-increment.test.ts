import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthoritativeGameService } from '../src/game/authoritative-game.service.js';

describe('Clocks and Fischer Increment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('credits Fischer increment after each accepted move', () => {
    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'clock-inc-test',
      mode: '2p',
      users: [
        { userId: 'p1', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'p2', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3, // 180,000 ms
      incrementSeconds: 2,   // 2,000 ms increment
      isRanked: true,
    });

    expect(game.clocksMs['p1']).toBe(180000);
    expect(game.clocksMs['p2']).toBe(180000);

    // Advance 5 seconds before Alice moves
    vi.advanceTimersByTime(5000);

    // Alice moves
    const res1 = service.processAction('clock-inc-test', 'p1', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });

    expect(res1.success).toBe(true);
    // Elapsed = 5000ms. Clock went down by 5000ms to 175000ms, then +2000ms increment = 177000ms
    expect(game.clocksMs['p1']).toBe(177000);
    // Bob's clock was untouched
    expect(game.clocksMs['p2']).toBe(180000);
  });

  it('triggers timeout and flags game when clock hits zero', () => {
    let timeoutFired = false;
    let endedReason: string | undefined;

    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'timeout-test',
      mode: '2p',
      users: [
        { userId: 'p1', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'p2', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
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

    // Advance time past 60 seconds
    vi.advanceTimersByTime(61000);

    expect(timeoutFired).toBe(true);
    expect(endedReason).toBe('TIMEOUT');
    expect(game.state.status).toBe('COMPLETED');
    expect(game.state.winnerId).toBe('p2'); // Bob wins by Alice's timeout
  });
});
