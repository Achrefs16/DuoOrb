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
  const liveSockets = new Map<
    string,
    {
      join: (room: string) => void;
      emit?: (event: string, payload: any) => void;
      directEmits?: { event: string }[];
    }
  >();
  const server = {
    sockets: {
      adapter: { rooms: { get: (r: string) => (r === roomName ? room : undefined) } },
      sockets: {
        get: (id: string) => liveSockets.get(id),
      },
    },
    to: (target: any) => ({
      emit: (event: string, payload: any) => emits.push({ target, event, payload }),
    }),
  };
  return { server: server as any, emits, room, liveSockets };
}

function makeGateway(prismaConnected = false) {
  const prisma = {
    isConnected: prismaConnected,
    profile: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    block: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const authService = {} as any;
  const gateway = new GameGateway(authService, prisma as any);
  const handleDisconnectSpy = vi.fn().mockReturnValue({ gracePeriodSeconds: 60, playerId: 'p1' });
  (gateway as any).gameService.handleDisconnect = handleDisconnectSpy;
  return { gateway, handleDisconnectSpy, prisma };
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

/**
 * Blocks must actually block: a blocked player can neither send nor receive
 * challenges, and matchmaking must never seat a blocked pair — in any mode.
 */
describe('GameGateway block enforcement', () => {
  let g: ReturnType<typeof makeGateway>;
  let f: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    g = makeGateway(true);
    f = fakeServer();
    (g.gateway as any).server = f.server;
  });

  function seat(userId: string, socketId: string) {
    const gw = g.gateway as any;
    gw.socketUserMap.set(socketId, { userId, displayName: userId, rating: 1500, verified: true });
    gw.userSocketMap.set(userId, socketId);
    const directEmits: { event: string; payload: any }[] = [];
    f.liveSockets.set(socketId, {
      join: () => {},
      emit: (event: string, payload: any) => directEmits.push({ event, payload }),
      directEmits,
    });
  }

  const challengePayload = { toUserId: 'uB', mode: '2p' as const, timeControlMinutes: 3 };

  it('rejects challenge:send to a blocked player, target never sees it', async () => {
    seat('uA', 'sock-A');
    seat('uB', 'sock-B');
    g.prisma.block.findFirst.mockResolvedValue({ id: 'b1' });

    const res = await g.gateway.handleChallengeSend(fakeSocket('sock-A'), challengePayload);

    expect(res).toMatchObject({ success: false });
    expect(g.prisma.block.findFirst).toHaveBeenCalled();
    expect(f.emits.filter((e) => e.event === 'challenge:received')).toHaveLength(0);
  });

  it('still sends when no block exists (target offline is the next gate)', async () => {
    seat('uA', 'sock-A');
    // uB has no live socket: the block check passes, presence fails next.
    const res = await g.gateway.handleChallengeSend(fakeSocket('sock-A'), challengePayload);

    expect(res).toMatchObject({ success: false, error: 'Friend is offline.' });
  });

  it('kills a challenge accepted after a block landed', async () => {
    seat('uA', 'sock-A');
    seat('uB', 'sock-B');
    const created = (g.gateway as any).challengeService.createChallenge(
      'uA', 'A', 'uB', '2p', 3, 0, 10, () => {}
    );
    g.prisma.block.findFirst.mockResolvedValue({ id: 'b1' });

    const res = await g.gateway.handleChallengeRespond(fakeSocket('sock-B'), {
      challengeId: created.challenge.id,
      accept: true,
    });

    expect(res).toMatchObject({ success: false });
    // No game is seated for either side...
    expect((g.gateway as any).activeGameUserMap.size).toBe(0);
    expect(f.emits.filter((e) => e.event === 'challenge:accepted')).toHaveLength(0);
    // ...and the sender's toast clears like a decline, not a hang.
    const senderEmits = (f.liveSockets.get('sock-A') as any).directEmits as { event: string }[];
    expect(senderEmits.map((e) => e.event)).toContain('challenge:declined');
  });

  it('matchmaking re-queues a blocked pair instead of seating them', async () => {
    seat('uA', 'sock-A');
    seat('uB', 'sock-B');
    const mm = (g.gateway as any).matchmakingService;
    const base = { mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10, rating: 1500 };
    mm.addToQueue({ ...base, userId: 'uA', displayName: 'A', socketId: 'sock-A', joinedAt: Date.now() });
    mm.addToQueue({ ...base, userId: 'uB', displayName: 'B', socketId: 'sock-B', joinedAt: Date.now() });
    g.prisma.block.findFirst.mockResolvedValue({ id: 'b1' });

    await (g.gateway as any).runMatchmakingSweep();

    // No game, nobody seated — and both keep searching past each other.
    expect((g.gateway as any).activeGameUserMap.size).toBe(0);
    expect(mm.getQueueLength()).toBe(2);
  });

  it('matchmaking still seats an unblocked pair', async () => {
    seat('uA', 'sock-A');
    seat('uB', 'sock-B');
    const mm = (g.gateway as any).matchmakingService;
    const base = { mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10, rating: 1500 };
    mm.addToQueue({ ...base, userId: 'uA', displayName: 'A', socketId: 'sock-A', joinedAt: Date.now() });
    mm.addToQueue({ ...base, userId: 'uB', displayName: 'B', socketId: 'sock-B', joinedAt: Date.now() });

    await (g.gateway as any).runMatchmakingSweep();

    expect((g.gateway as any).activeGameUserMap.size).toBe(2);
    expect(mm.getQueueLength()).toBe(0);
  });
});

/**
 * Reconnect bursts (queue flush + reconnect effect + retry tick) emit
 * several `game:join` within milliseconds. The pump answers every join
 * (the retry backstop depends on it) while replay side effects stay
 * exactly-once — no lost moves, no double applies, one fan-out per truth.
 */
describe('GameGateway join pump', () => {
  it('burst joins are all answered with exactly-once side effects', async () => {
    const { gateway } = makeGateway(false);
    const gw = gateway as any;
    const roomEmits: { event: string; payload: unknown }[] = [];
    gw.server = {
      sockets: { sockets: { get: () => undefined }, adapter: { rooms: { get: () => undefined } } },
      to: () => ({ emit: (event: string, payload: unknown) => roomEmits.push({ event, payload }) }),
    };
    gw.gameService.createGame({
      gameId: 'jp1',
      mode: '2p',
      users: [
        { userId: 'uA', displayName: 'A', rating: { rating: 1500, rd: 350, vol: 0.06 } },
        { userId: 'uB', displayName: 'B', rating: { rating: 1500, rd: 350, vol: 0.06 } },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    gw.userSocketMap.set('uA', 'sock-A');
    const syncs: unknown[] = [];
    const client = {
      id: 'sock-A',
      handshake: { query: {} },
      join: () => {},
      emit: (event: string, payload: unknown) => {
        if (event === 'game:sync') syncs.push(payload);
      },
    };
    const move = { type: 'MOVE', to: { row: 7, col: 4 } };
    const withMove = {
      gameId: 'jp1',
      lastSequence: 0,
      pendingActions: [{ clientActionId: 'c1', action: move }],
    };

    // Burst: bare join, join carrying the unconfirmed move, same join again.
    gw.handleJoinGame(client, { gameId: 'jp1', lastSequence: 0, pendingActions: [] });
    gw.handleJoinGame(client, withMove);
    gw.handleJoinGame(client, withMove);
    // Let every queued pump pass settle.
    await new Promise((r) => setTimeout(r, 50));

    // First + latest passes answer the burst (the middle payload is
    // superseded, not lost — the trailing sync is the fresher truth)...
    expect(syncs).toHaveLength(2);
    // ...the move applied exactly once, broadcast exactly once.
    expect(roomEmits.filter((e) => e.event === 'game:actionAccepted')).toHaveLength(1);
    expect(gw.gameService.getGame('jp1')!.state.history).toHaveLength(1);

    // ...and a later sequential join (the retry backstop) is answered on
    // its own, with the replay suppressed as a duplicate.
    gw.handleJoinGame(client, withMove);
    await new Promise((r) => setTimeout(r, 50));
    expect(syncs).toHaveLength(3);
    expect(roomEmits.filter((e) => e.event === 'game:actionAccepted')).toHaveLength(1);

    const game = gw.gameService.getGame('jp1')!;
    if (game.timerInterval) clearInterval(game.timerInterval);
    for (const t of game.afkTimers.values()) clearTimeout(t);
  });
});