import { describe, expect, it } from 'vitest';
import { AuthoritativeGameService } from '../src/game/authoritative-game.service.js';

describe('Authoritative Game Service', () => {
  it('creates an authoritative game and processes valid actions with monotonic sequence numbers', () => {
    const service = new AuthoritativeGameService();
    const game = service.createGame({
      gameId: 'test-game-1',
      mode: '2p',
      users: [
        { userId: 'user-a', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'user-b', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });

    expect(game.state.status).toBe('IN_PROGRESS');
    expect(game.state.players).toHaveLength(2);

    // Alice (p1) moves to (7, 4)
    const res1 = service.processAction('test-game-1', 'user-a', {
      type: 'MOVE',
      to: { row: 7, col: 4 },
    });

    expect(res1.success).toBe(true);
    if (!res1.success) return;
    expect(res1.recorded.sequence).toBe(1);
    expect(res1.recorded.playerId).toBe('p1');

    // Bob (p2) attempts to move out of turn when it's Alice's turn -> should fail!
    // Wait, after res1 it is now Bob's turn. Alice attempts to move again:
    const resAliceAgain = service.processAction('test-game-1', 'user-a', {
      type: 'MOVE',
      to: { row: 6, col: 4 },
    });
    expect(resAliceAgain.success).toBe(false);
    if (!resAliceAgain.success) {
      expect(resAliceAgain.error.code).toBe('NOT_YOUR_TURN');
    }

    // Bob moves legally to (1, 4)
    const res2 = service.processAction('test-game-1', 'user-b', {
      type: 'MOVE',
      to: { row: 1, col: 4 },
    });
    expect(res2.success).toBe(true);
    if (!res2.success) return;
    expect(res2.recorded.sequence).toBe(2);
    expect(res2.recorded.playerId).toBe('p2');
  });

  it('synchronizes reconnecting client with missing actions', () => {
    const service = new AuthoritativeGameService();
    service.createGame({
      gameId: 'sync-game',
      mode: '2p',
      users: [
        { userId: 'user-a', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'user-b', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: false,
    });

    // Play 2 moves
    service.processAction('sync-game', 'user-a', { type: 'MOVE', to: { row: 7, col: 4 } });
    service.processAction('sync-game', 'user-b', { type: 'MOVE', to: { row: 1, col: 4 } });

    // Client reconnects having only seen move 1
    const sync = service.getSyncState('sync-game', 1);
    expect(sync).not.toBeNull();
    expect(sync?.missingActions).toHaveLength(1);
    expect(sync?.missingActions[0].sequence).toBe(2);
    expect(sync?.state.moveNumber).toBe(3);
  });
});
