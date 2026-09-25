import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthoritativeGameService } from '../src/game/authoritative-game.service.js';

describe('Reconnect and Grace Period', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets 60s grace period for ranked disconnect and forfeits if expired', () => {
    let forfeitFired = false;
    let endedWinner: string | null = null;
    let endedReason: string | undefined;

    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'reconnect-game',
      mode: '2p',
      users: [
        { userId: 'u1', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u2', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });

    // Alice disconnects
    const res = service.handleDisconnect('reconnect-game', 'u1', (ended) => {
      forfeitFired = true;
      endedWinner = ended.winnerId;
      endedReason = ended.reason;
    });

    expect(res?.gracePeriodSeconds).toBe(60);
    expect(game.disconnectedUsers['u1']).toBeDefined();

    // Advance 61 seconds
    vi.advanceTimersByTime(61000);

    expect(forfeitFired).toBe(true);
    expect(endedWinner).toBe('p2'); // Bob wins
    expect(endedReason).toBe('DISCONNECT');
    expect(game.state.status).toBe('COMPLETED');
  });

  it('cancels grace timer when player reconnects in time', () => {
    let forfeitFired = false;

    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'reconnect-save',
      mode: '2p',
      users: [
        { userId: 'u1', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u2', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });

    service.handleDisconnect('reconnect-save', 'u1', () => {
      forfeitFired = true;
    });

    // 20 seconds pass
    vi.advanceTimersByTime(20000);

    // Alice reconnects
    const sync = service.handleReconnect('reconnect-save', 'u1');
    expect(sync).not.toBeNull();
    expect(game.disconnectedUsers['u1']).toBeUndefined();

    // Advance another 50 seconds (total 70s since disconnect)
    vi.advanceTimersByTime(50000);

    // Forfeit should NOT fire
    expect(forfeitFired).toBe(false);
    expect(game.state.status).toBe('IN_PROGRESS');
  });
});
