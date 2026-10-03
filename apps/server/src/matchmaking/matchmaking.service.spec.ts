import { describe, it, expect } from 'vitest';
import { MatchmakingService } from './matchmaking.service.js';

function req(partial: Partial<Parameters<MatchmakingService['addToQueue']>[0]> = {}) {
  return {
    userId: 'u1',
    displayName: 'P1',
    rating: 1500,
    mode: '2p' as const,
    timeControlMinutes: 3,
    incrementSeconds: 0,
    wallsEach: 10,
    joinedAt: Date.now(),
    socketId: 's1',
    ...partial,
  };
}

describe('MatchmakingService liveness (F3)', () => {
  it('purges dead-socket entries before they can be seated', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', socketId: 's-live' }));
    mm.addToQueue(req({ userId: 'uGhost', socketId: 's-dead' }));
    const purged = mm.purgeDisconnected((sid) => sid === 's-live');
    expect(purged).toEqual(['uGhost']);
    expect(mm.getQueueLength()).toBe(1);
    expect(mm.findMatches()).toHaveLength(0); // u1 alone: no pair, still queued
    expect(mm.getQueueLength()).toBe(1);
  });

  it('requeue preserves the original joinedAt — wait time survives a requeue', () => {
    const mm = new MatchmakingService();
    const joinedAt = Date.now() - 30_000;
    mm.addToQueue(req({ userId: 'u1', socketId: 's1', joinedAt }));
    mm.addToQueue(req({ userId: 'u2', socketId: 's2', joinedAt }));
    const [match] = mm.findMatches(); // dequeued by the sweep
    expect(match).toBeTruthy();
    expect(mm.getQueueLength()).toBe(0);
    mm.requeue(match.players[0]); // blocked pair / failed creation path
    const requeued = (mm as any).queue.find((q: any) => q.userId === 'u1');
    expect(requeued.joinedAt).toBe(joinedAt);
  });
});

describe('MatchmakingService concurrency', () => {
  it('keeps exactly one entry per user across reconnects/requeues', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', socketId: 's-old' }));
    mm.addToQueue(req({ userId: 'u1', socketId: 's-new' }));
    mm.addToQueue(req({ userId: 'u1', socketId: 's-newest' }));
    expect(mm.getQueueLength()).toBe(1);
  });

  it('refreshes the socket line on reconnect', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', socketId: 's-old' }));
    mm.updateSocket('u1', 's-new');
    mm.addToQueue(req({ userId: 'u2', socketId: 's2' }));
    const matches = mm.findMatches();
    expect(matches).toHaveLength(1);
    expect(mm.getQueueLength()).toBe(0);
  });

  it('never pairs the same user twice in one sweep', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', socketId: 's1' }));
    mm.addToQueue(req({ userId: 'u2', socketId: 's2' }));
    mm.addToQueue(req({ userId: 'u3', socketId: 's3' }));
    const matches = mm.findMatches();
    expect(matches).toHaveLength(1);
    const ids = matches.flatMap((m) => [m.player1.userId, m.player2.userId]);
    expect(new Set(ids).size).toBe(2);
    expect(mm.getQueueLength()).toBe(1);
  });

  it('only pairs identical mode + clock', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', mode: '2p' }));
    mm.addToQueue(req({ userId: 'u2', mode: 'race2' as never }));
    expect(mm.findMatches()).toHaveLength(0);
    expect(mm.getQueueLength()).toBe(2);
  });

  it('does not match different wall configurations', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', wallsEach: 10 }));
    mm.addToQueue(req({ userId: 'u2', wallsEach: 15 }));
    expect(mm.findMatches()).toHaveLength(0);
  });

  it('waits for the full 3P/4P table before matching', () => {
    const mm = new MatchmakingService();
    mm.addToQueue(req({ userId: 'u1', mode: 'center3' as never }));
    mm.addToQueue(req({ userId: 'u2', mode: 'center3' as never }));
    expect(mm.findMatches()).toHaveLength(0);
    mm.addToQueue(req({ userId: 'u3', mode: 'center3' as never }));
    const matches = mm.findMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].players).toHaveLength(3);
    expect(mm.getQueueLength()).toBe(0);
  });
});
