import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameGateway } from './game.gateway.js';

/**
 * Disconnect teardown: which socket is allowed to speak for a user.
 *
 * The regression this file exists for: a player reconnects (new socket), and
 * the OLD socket's teardown then runs and forfeits the seat the player had
 * just reclaimed. Nothing in the service can tell the difference — the call
 * looks identical to a real disconnect — so the guard has to live here.
 */

/** Minimal socket: the gateway only reads id + handshake. */
function fakeSocket(id: string) {
  return { id, handshake: { query: {} as Record<string, string> } } as any;
}

/** Server stub recording who each emit went to. */
function fakeServer(roomName = 'g1') {
  const emits: { target: unknown; event: string; payload: any }[] = [];
  const room = new Set<string>();
  const server = {
    sockets: { adapter: { rooms: { get: (r: string) => (r === roomName ? room : undefined) } } },
    to: (target: any) => ({
      emit: (event: string, payload: any) => emits.push({ target, event, payload }),
    }),
  };
  return { server: server as any, emits, room };
}

function makeGateway(prismaConnected = false) {
  const prisma = {
    isConnected: prismaConnected,
    profile: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const authService = {} as any;
  const gateway = new GameGateway(authService, prisma as any);
  const handleDisconnectSpy = vi.fn().mockReturnValue({ gracePeriodSeconds: 60, playerId: 'p1' });
  (gateway as any).gameService.handleDisconnect = handleDisconnectSpy;
  return { gateway, handleDisconnectSpy };
}

describe('GameGateway.handleDisconnect', () => {
  let g: ReturnType<typeof makeGateway>;
  let f: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    g = makeGateway();
    f = fakeServer();
    (g.gateway as any).server = f.server;
  });

  function seat(userId: string, socketId: string, gameId = 'g1') {
    const gw = g.gateway as any;
    gw.socketUserMap.set(socketId, { userId, displayName: userId, rating: 1500, verified: true });
    gw.userSocketMap.set(userId, socketId);
    gw.activeGameUserMap.set(userId, gameId);
  }

  it('ignores a stale socket that a newer one already superseded', () => {
    seat('uA', 'sock-NEW');
    // The old socket's entry is still around — that is the whole problem.
    (g.gateway as any).socketUserMap.set('sock-OLD', {
      userId: 'uA',
      displayName: 'uA',
      rating: 1500,
      verified: true,
    });

    g.gateway.handleDisconnect(fakeSocket('sock-OLD'));

    // No forfeit, and the live mapping survives intact.
    expect(g.handleDisconnectSpy).not.toHaveBeenCalled();
    expect((g.gateway as any).userSocketMap.get('uA')).toBe('sock-NEW');
    expect((g.gateway as any).activeGameUserMap.get('uA')).toBe('g1');
    // The dead socket is cleaned up so it can never be consulted again.
    expect((g.gateway as any).socketUserMap.has('sock-OLD')).toBe(false);
    expect(f.emits).toHaveLength(0);
  });

  it('forfeits on the live socket and retracts only its own mapping', () => {
    seat('uA', 'sock-A');
    f.room.add('sock-A');
    f.room.add('sock-B');

    g.gateway.handleDisconnect(fakeSocket('sock-A'));

    expect(g.handleDisconnectSpy).toHaveBeenCalledTimes(1);
    expect(g.handleDisconnectSpy.mock.calls[0][0]).toBe('g1');
    expect(g.handleDisconnectSpy.mock.calls[0][1]).toBe('uA');
    expect((g.gateway as any).userSocketMap.has('uA')).toBe(false);
    // The seat stays active on purpose: the match is still running under a
    // grace timer, so the game→user mapping is only released when the
    // forfeit callback actually ends it.
    expect((g.gateway as any).activeGameUserMap.get('uA')).toBe('g1');
  });

  it('tells the OPPONENT seat only, with the playerId, never the leaver', () => {
    seat('uA', 'sock-A');
    // uA reconnects on a second device while their first socket dies, so
    // their own socket is still sitting in the game room.
    f.room.add('sock-A');
    f.room.add('sock-A2');
    f.room.add('sock-B');
    (g.gateway as any).socketUserMap.set('sock-A2', {
      userId: 'uA',
      displayName: 'uA',
      rating: 1500,
      verified: true,
    });
    f.room.add('sock-C');

    g.gateway.handleDisconnect(fakeSocket('sock-A'));

    const disc = f.emits.filter((e) => e.event === 'game:opponentDisconnected');
    expect(disc).toHaveLength(1);
    expect(disc[0].target).toEqual(['sock-B', 'sock-C']);
    expect(disc[0].payload).toMatchObject({
      userId: 'uA',
      playerId: 'p1',
      gracePeriodSeconds: 60,
    });
  });

  it('does nothing for a socket with no identity', () => {
    g.gateway.handleDisconnect(fakeSocket('sock-UNKNOWN'));
    expect(g.handleDisconnectSpy).not.toHaveBeenCalled();
    expect(f.emits).toHaveLength(0);
  });
});