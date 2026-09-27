import { describe, it, expect } from 'vitest';
import { AuthoritativeGameService } from './authoritative-game.service.js';

/**
 * Seat resolution is now server-authoritative.
 *
 * The client used to work out which seat was its own by comparing the seat
 * map against a local user id it had captured earlier. When that id was
 * stale the comparison failed, `myPlayerId` stayed null, and the UI sat on
 * "Connecting to match" over a board that was already receiving moves. The
 * sync payload now names the seat explicitly.
 */
describe('authoritative seat resolution', () => {
  const svc = () => new AuthoritativeGameService(undefined as any);

  it('tells each verified user which seat is theirs', () => {
    const service = svc();
    const game = service.createGame({
      gameId: 'seat-test',
      mode: '2p',
      users: [
        { userId: 'u_alice', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u_bob', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 10,
      incrementSeconds: 0,
      wallsEach: 15,
      isRanked: true,
    });
    expect(game).toBeTruthy();

    const alice = service.getSyncState('seat-test', 0, 'u_alice');
    const bob = service.getSyncState('seat-test', 0, 'u_bob');

    expect(alice?.you).toBeTruthy();
    expect(bob?.you).toBeTruthy();
    // Different seats, and each one is actually one of the game's players.
    expect(alice?.you).not.toBe(bob?.you);
    expect(alice?.state.players.map((p) => p.id)).toContain(alice?.you);
    expect(bob?.state.players.map((p) => p.id)).toContain(bob?.you);
  });

  it('omits `you` for a user who is not seated', () => {
    const service = svc();
    service.createGame({
      gameId: 'seat-stranger',
      mode: '2p',
      users: [
        { userId: 'u_alice', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u_bob', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 10,
      incrementSeconds: 0,
      wallsEach: 15,
      isRanked: true,
    });

    const stranger = service.getSyncState('seat-stranger', 0, 'u_someone_else');
    expect(stranger?.you).toBeNull();
  });

  it('reconnect carries the same seat back to the same user', () => {
    const service = svc();
    service.createGame({
      gameId: 'seat-reconnect',
      mode: '2p',
      users: [
        { userId: 'u_alice', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u_bob', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 10,
      incrementSeconds: 0,
      wallsEach: 15,
      isRanked: true,
    });

    const first = service.getSyncState('seat-reconnect', 0, 'u_bob');
    const reconnected = service.handleReconnect('seat-reconnect', 'u_bob');
    expect(reconnected?.you).toBe(first?.you);
  });

  it('a caller who supplies no user id gets no seat claim', () => {
    const service = svc();
    service.createGame({
      gameId: 'seat-anonymous',
      mode: '2p',
      users: [
        { userId: 'u_alice', displayName: 'Alice', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'u_bob', displayName: 'Bob', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 10,
      incrementSeconds: 0,
      wallsEach: 15,
      isRanked: true,
    });

    expect(service.getSyncState('seat-anonymous', 0)?.you).toBeUndefined();
  });
});
