import { describe, expect, it } from 'vitest';
import { MatchmakingService } from '../src/matchmaking/matchmaking.service.js';

describe('Matchmaking Service', () => {
  it('pairs players with matching mode, clock, and rating window', () => {
    const service = new MatchmakingService();

    service.addToQueue({
      userId: 'p1',
      displayName: 'Player 1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      incrementSeconds: 0,
      joinedAt: Date.now(),
      socketId: 'sock-1',
    });

    service.addToQueue({
      userId: 'p2',
      displayName: 'Player 2',
      rating: 1520, // within 50 initial window
      mode: '2p',
      timeControlMinutes: 3,
      incrementSeconds: 0,
      joinedAt: Date.now(),
      socketId: 'sock-2',
    });

    const matches = service.findMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].player1.userId).toBe('p1');
    expect(matches[0].player2.userId).toBe('p2');
    expect(service.getQueueLength()).toBe(0);
  });

  it('does not pair incompatible modes or time controls', () => {
    const service = new MatchmakingService();

    service.addToQueue({
      userId: 'p1',
      displayName: 'Player 1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      joinedAt: Date.now(),
      socketId: 'sock-1',
    });

    service.addToQueue({
      userId: 'p2',
      displayName: 'Player 2',
      rating: 1500,
      mode: '4p', // different mode!
      timeControlMinutes: 3,
      joinedAt: Date.now(),
      socketId: 'sock-2',
    });

    const matches = service.findMatches();
    expect(matches).toHaveLength(0);
    expect(service.getQueueLength()).toBe(2);
  });

  it('supports cancellation from queue', () => {
    const service = new MatchmakingService();
    service.addToQueue({
      userId: 'p1',
      displayName: 'Player 1',
      rating: 1500,
      mode: '2p',
      timeControlMinutes: 3,
      joinedAt: Date.now(),
      socketId: 'sock-1',
    });

    expect(service.getQueueLength()).toBe(1);
    const removed = service.removeFromQueue('p1');
    expect(removed).toBe(true);
    expect(service.getQueueLength()).toBe(0);
  });
});
