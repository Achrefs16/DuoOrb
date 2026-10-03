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
        has: (id: string) => liveSockets.has(id),
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

/**
 * F1 terminal-path unification: every ended game must flow through endGame()
 * (persist → emit → free seats/presence/room). The regression this exists
 * for: terminal resign emitted `game:ended` but never freed the game, so the
 * room stayed IN_GAME and both players looked permanently "playing".
 */
describe('GameGateway terminal resign (F1)', () => {
  function seatedGateway() {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('g1');
    gw.server = f.server;
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    gw.userSocketMap.set('uA', 'sock-A');
    gw.activeGameUserMap.set('uA', 'g1');
    gw.activeGameUserMap.set('uB', 'g1');
    vi.spyOn(gw.gameService, 'getGame').mockReturnValue({
      playerUserIds: { p1: 'uA', p2: 'uB' },
    } as any);
    vi.spyOn(gw.gameService, 'persistCompleted').mockResolvedValue(undefined);
    return { gw, f };
  }

  it('terminal resign emits ended, frees both seats, and returns the room to lobby', async () => {
    const { gw, f } = seatedGateway();
    const room = gw.roomService.createRoom('uA', 'A', 'classic', 5);
    room.status = 'IN_GAME';
    gw.gameRoomMap.set('g1', room.id);
    const ended = { gameId: 'g1', reason: 'RESIGNATION' };
    vi.spyOn(gw.gameService, 'resign').mockResolvedValue({
      success: true,
      recorded: { seq: 1 },
      finished: { playerId: 'p1', userId: 'uA', place: 2 },
      ended,
    } as any);
    const client = { id: 'sock-A', handshake: { query: {} }, emit: vi.fn() };

    await gw.handleResign(client, { gameId: 'g1' });

    const events = f.emits.map((e: { event: string }) => e.event);
    expect(events).toContain('game:ended');
    // Seats freed so rematch/challenge/matchmaking work again.
    expect(gw.activeGameUserMap.has('uA')).toBe(false);
    expect(gw.activeGameUserMap.has('uB')).toBe(false);
    // Room handed back to its lobby and announced.
    expect(gw.gameRoomMap.has('g1')).toBe(false);
    expect(room.status).toBe('WAITING');
    expect(events).toContain('room:state');
  });

  it('mid-table forfeit emits the forfeit move before playerFinished', () => {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('g1');
    gw.server = f.server;
    const move = { seq: 7, action: { type: 'TIMEOUT' } };

    gw.emitMidGameForfeit('g1', null, { playerId: 'p1', userId: 'uA', place: 2 }, move as any);

    expect(f.emits.map((e: { event: string }) => e.event)).toEqual([
      'game:actionAccepted',
      'game:playerFinished',
    ]);
  });
});

/**
 * F2 guarded creation + migration unity.
 */
describe('GameGateway createGameChecked + migrateIdentity (F2)', () => {
  function liveGateway() {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('g1');
    gw.server = f.server;
    return { gw, f };
  }

  function seatLive(gw: any, userId: string, socketId: string, clients: Map<string, any>) {
    gw.socketUserMap.set(socketId, { userId, displayName: userId, rating: 1500, verified: true });
    gw.userSocketMap.set(userId, socketId);
    clients.set(socketId, { id: socketId, join: () => {} });
  }

  it('refuses to create a game with an offline seat — nothing is created', async () => {
    const { gw } = liveGateway();
    const clients = new Map<string, any>();
    seatLive(gw, 'uA', 'sock-A', clients);
    // uB has no socket at all.
    gw.server.sockets.sockets.get = (id: string) => clients.get(id);
    const createSpy = vi.spyOn(gw.gameService, 'createGame');

    const res = await gw.createGameChecked({
      gameId: 'gX',
      mode: '2p',
      seatUserIds: ['uA', 'uB'],
      timeControlMinutes: 3,
      isRanked: true,
    });

    expect(res.success).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
    expect(gw.activeGameUserMap.has('uA')).toBe(false);
  });

  it('challenge accept with an offline sender dies like a decline (C2)', async () => {
    const { gw, f } = liveGateway();
    const clients = new Map<string, any>();
    // Recipient live; sender gone.
    seatLive(gw, 'uB', 'sock-B', clients);
    gw.server.sockets.sockets.get = (id: string) => clients.get(id);
    vi.spyOn(gw.challengeService, 'resolve').mockReturnValue({
      success: true,
      challenge: {
        id: 'c1', fromUserId: 'uA', fromDisplayName: 'A', toUserId: 'uB',
        mode: '2p', timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10,
      },
    } as any);
    vi.spyOn(gw, 'isBlockedBetween').mockResolvedValue(false);
    const createSpy = vi.spyOn(gw.gameService, 'createGame');
    const client = { id: 'sock-B', handshake: { query: {} }, emit: vi.fn() };

    const res = await gw.handleChallengeRespond(client, { challengeId: 'c1', accept: true });

    expect(res.success).toBe(false);
    expect(createSpy).not.toHaveBeenCalled();
    expect(gw.activeGameUserMap.has('uB')).toBe(false);
    expect(f.emits).toHaveLength(0); // nobody told about a match that never came
  });

  it('isUserInLiveGame resolves seats by playerId: finished seats do not block (M1)', () => {
    const { gw } = liveGateway();
    gw.activeGameUserMap.set('uA', 'g1');
    gw.activeGameUserMap.set('uB', 'g1');
    vi.spyOn(gw.gameService, 'getGame').mockReturnValue({
      state: {
        status: 'IN_PROGRESS',
        players: [
          { id: 'p1', status: 'FINISHED' },
          { id: 'p2', status: 'ACTIVE' },
        ],
      },
      userPlayerIds: { uA: 'p1', uB: 'p2' },
    } as any);

    expect(gw.isUserInLiveGame('uA')).toBe(false);
    expect(gw.isUserInLiveGame('uB')).toBe(true);
    expect(gw.isUserInLiveGame('uNobody')).toBe(false);
  });

  it('migrateIdentity moves state, drops stale routing, and refuses live steals', () => {
    const { gw } = liveGateway();
    const joins: string[] = [];
    const client = { id: 's-new', join: (r: string) => joins.push(r) };
    // Previous identity on a dead socket: free to migrate.
    gw.socketUserMap.set('s-new', { userId: 'uGuest', displayName: 'G', rating: 1500, verified: true });
    gw.userSocketMap.set('uGuest', 's-dead');
    gw.activeGameUserMap.set('uGuest', 'g1');
    gw.server.sockets.sockets.get = () => undefined;

    const ok = gw.migrateIdentity('uGuest', 'uAcc', 'Acc', client as any, 1500);

    expect(ok).toEqual({ success: true });
    expect(gw.userSocketMap.get('uGuest')).toBeUndefined();
    expect(gw.userSocketMap.get('uAcc')).toBe('s-new');
    expect(gw.activeGameUserMap.get('uAcc')).toBe('g1');
    expect(gw.activeGameUserMap.has('uGuest')).toBe(false);

    // Same call against a LIVE previous socket: refusal, nothing moved.
    gw.userSocketMap.set('uLive', 's-live');
    gw.server.sockets.sockets.get = (id: string) =>
      id === 's-live' ? { id: 's-live' } : undefined;
    const refused = gw.migrateIdentity('uLive', 'uAcc2', 'Acc2', client as any, 1500);
    expect(refused.success).toBe(false);
    expect(gw.userSocketMap.get('uLive')).toBe('s-live');
    expect(gw.userSocketMap.has('uAcc2')).toBe(false);
  });
});

/**
 * F3 sweep liveness: dead queue entries are purged before matching, and the
 * matched event reaches live sockets (not pre-sweep snapshots).
 */
describe('GameGateway sweep liveness (F3)', () => {
  function queued(mm: any, userId: string, socketId: string) {
    mm.addToQueue({
      userId, displayName: userId, rating: 1500, mode: '2p' as const,
      timeControlMinutes: 3, incrementSeconds: 0, wallsEach: 10,
      joinedAt: Date.now(), socketId,
    });
  }

  it('purges dead queue entries, matches the live pair on live sockets', async () => {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('g1');
    gw.server = f.server;
    // Real Map so purgeDisconnected (.has) and lookups (.get) both work.
    const liveSockets = new Map<string, any>();
    for (const [uid, sid] of [['uA', 'sock-A'], ['uB', 'sock-B']]) {
      gw.socketUserMap.set(sid, { userId: uid, displayName: uid, rating: 1500, verified: true });
      gw.userSocketMap.set(uid, sid);
      liveSockets.set(sid, { id: sid, join: () => {} });
    }
    gw.server.sockets.sockets = liveSockets;
    queued(gw.matchmakingService, 'uA', 'sock-A');
    queued(gw.matchmakingService, 'uB', 'sock-B');
    queued(gw.matchmakingService, 'uGhost', 'sock-dead');

    await gw.runMatchmakingSweep();

    // Live pair seated in one game; ghost purged, never seated, queue empty.
    const gA = gw.activeGameUserMap.get('uA');
    expect(gA).toBeTruthy();
    expect(gw.activeGameUserMap.get('uB')).toBe(gA);
    expect(gw.matchmakingService.getQueueLength()).toBe(0);
    const matched = f.emits.filter((e: { event: string }) => e.event === 'matchmaking:matched');
    expect(matched.map((e: { target: unknown }) => e.target).sort()).toEqual(['sock-A', 'sock-B']);

    // Cleanup: the sweep created a real game with real timers.
    const game = gw.gameService.getGame(gA);
    if (game?.timerInterval) clearInterval(game.timerInterval);
    if (game) for (const t of game.afkTimers.values()) clearTimeout(t);
  });
});

/**
 * F5 ping gating: latency samples are trusted only from the turn holder, in
 * a live game, at most one per second. Anything wider let any seat bank the
 * refund cap with backdated stamps, farmed off-turn.
 */describe('GameGateway ping gating (F5)', () => {
  function pingGame() {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('gping');
    gw.server = f.server;
    const R = { rating: 1500, rd: 350, vol: 0.06 };
    gw.gameService.createGame({
      gameId: 'gping',
      mode: '2p' as const,
      users: [
        { userId: 'uA', displayName: 'A', rating: R },
        { userId: 'uB', displayName: 'B', rating: R },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    gw.gameService.markSeatJoined('gping', 'uA');
    gw.gameService.markSeatJoined('gping', 'uB');
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    gw.socketUserMap.set('sock-B', { userId: 'uB', displayName: 'B', rating: 1500, verified: true });
    const sock = (id: string) => ({ id, handshake: { query: {} } }) as any;
    return { gw, sock };
  }

  function cleanup(gw: any) {
    const game = gw.gameService.getGame('gping');
    if (game?.timerInterval) clearInterval(game.timerInterval);
    if (game?.quorumTimeout) clearTimeout(game.quorumTimeout);
    if (game?.flagTimeout) clearTimeout(game.flagTimeout);
    if (game) for (const t of game.afkTimers.values()) clearTimeout(t);
  }

  it('samples only the turn holder, throttled — ack always answers', () => {
    const { gw, sock } = pingGame();
    try {
      const rec = vi.spyOn(gw.gameService, 'recordLatency');
      const ack = vi.fn();
      // uB is not on turn (uA opens): ignored.
      gw.handleGamePing(sock('sock-B'), { gameId: 'gping', clientSentAt: Date.now() - 100 }, ack);
      expect(rec).not.toHaveBeenCalled();
      // Holder's sample records...
      gw.handleGamePing(sock('sock-A'), { gameId: 'gping', clientSentAt: Date.now() - 100 }, ack);
      expect(rec).toHaveBeenCalledTimes(1);
      // ...but a second sample inside the throttle window does not.
      gw.handleGamePing(sock('sock-A'), { gameId: 'gping', clientSentAt: Date.now() - 100 }, ack);
      expect(rec).toHaveBeenCalledTimes(1);
      // The ack (client clock correction) is ungated: probes stay useful
      // for sync even when the sample is refused.
      expect(ack).toHaveBeenCalledTimes(3);
    } finally {
      cleanup(gw);
    }
  });
});

/**
 * F8 explicit rematch decline: the offeror stops waiting now instead of
 * idling out the 30s server TTL.
 */describe('GameGateway rematch decline (F8)', () => {
  it('decline clears the offer and notifies the room', () => {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('gold');
    gw.server = f.server;
    const R = { rating: 1500, rd: 350, vol: 0.06 };
    gw.gameService.createGame({
      gameId: 'gold',
      mode: '2p' as const,
      users: [
        { userId: 'uA', displayName: 'A', rating: R },
        { userId: 'uB', displayName: 'B', rating: R },
      ],
      timeControlMinutes: 3,
      isRanked: true,
    });
    try {
      const game = gw.gameService.getGame('gold');
      game.state.status = 'COMPLETED';
      game.rematchOffers.add('uA'); // offeror waiting
      gw.socketUserMap.set('sock-B', { userId: 'uB', displayName: 'B', rating: 1500, verified: true });

      gw.handleRematchDecline({ id: 'sock-B', handshake: { query: {} } } as any, { gameId: 'gold' });

      expect(game.rematchOffers.has('uA')).toBe(true); // offeror's wait untouched server-side
      expect(game.rematchOffers.has('uB')).toBe(false);
      const declined = f.emits.filter((e: { event: string }) => e.event === 'game:rematchDeclined');
      expect(declined).toHaveLength(1);
      expect(declined[0].payload).toMatchObject({ gameId: 'gold', byUserId: 'uB' });
      // Strangers and live games: silent no-ops, no broadcast.
      gw.handleRematchDecline({ id: 'sock-X', handshake: { query: {} } } as any, { gameId: 'gold' });
      game.state.status = 'IN_PROGRESS';
      gw.handleRematchDecline({ id: 'sock-B', handshake: { query: {} } } as any, { gameId: 'gold' });
      expect(f.emits.filter((e: { event: string }) => e.event === 'game:rematchDeclined')).toHaveLength(1);
    } finally {
      const game = gw.gameService.getGame('gold');
      if (game?.timerInterval) clearInterval(game.timerInterval);
      if (game?.quorumTimeout) clearTimeout(game.quorumTimeout);
      if (game?.flagTimeout) clearTimeout(game.flagTimeout);
      if (game) for (const t of game.afkTimers.values()) clearTimeout(t);
    }
  });
});

/**
 * F10 lobby hygiene on disconnect + fail-closed challenges + ready auth.
 */
describe('GameGateway lobby hygiene (F10)', () => {
  function liveGateway() {
    const { gateway } = makeGateway();
    const gw = gateway as any;
    const f = fakeServer('g1');
    gw.server = f.server;
    return { gw, f };
  }

  it('disconnect frees WAITING seats (host hands over) with a broadcast', () => {
    const { gw, f } = liveGateway();
    const room = gw.roomService.createRoom('uA', 'A', '2p', 3, 0, 10);
    gw.roomService.joinRoom(room.code, 'uB', 'B');
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    gw.socketUserMap.set('sock-B', { userId: 'uB', displayName: 'B', rating: 1500, verified: true });
    gw.userSocketMap.set('uA', 'sock-A');
    gw.userSocketMap.set('uB', 'sock-B');

    gw.handleDisconnect({ id: 'sock-A', handshake: { query: {} } } as any);

    const after = gw.roomService.getRoom(room.id);
    expect(after.slots.some((s: any) => s.userId === 'uA')).toBe(false);
    expect(after.hostId).toBe('uB');
    const states = f.emits.filter((e: { event: string }) => e.event === 'room:state');
    expect(states.length).toBeGreaterThan(0);
  });

  it('disconnect never ejects a seat from an IN_GAME room', () => {
    const { gw } = liveGateway();
    const room = gw.roomService.createRoom('uA', 'A', '2p', 3, 0, 10);
    gw.roomService.joinRoom(room.code, 'uB', 'B');
    room.status = 'IN_GAME';
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    gw.userSocketMap.set('uA', 'sock-A');

    gw.handleDisconnect({ id: 'sock-A', handshake: { query: {} } } as any);

    const after = gw.roomService.getRoom(room.id);
    expect(after.slots.some((s: any) => s.userId === 'uA')).toBe(true);
  });

  it('challenges fail closed while the database is unreachable', async () => {
    const { gw } = liveGateway(); // makeGateway(false): prisma disconnected
    gw.socketUserMap.set('sock-A', { userId: 'uA', displayName: 'A', rating: 1500, verified: true });
    const sendRes = await gw.handleChallengeSend(
      { id: 'sock-A', handshake: { query: {} } } as any,
      { toUserId: 'uB', mode: '2p', timeControlMinutes: 3 }
    );
    expect(sendRes.success).toBe(false);
    expect(sendRes.error).toMatch(/blocks/i);
  });

  it('room:ready from an unverified socket answers instead of silent-return', () => {
    const { gw, f } = liveGateway();
    const client = {
      id: 'sock-X',
      handshake: { query: {} },
      emit: vi.fn(),
    };
    gw.handleRoomReady(client as any, { roomId: 'r1', isReady: true });
    expect(client.emit).toHaveBeenCalledWith(
      'game:error',
      expect.objectContaining({ code: 'UNAUTHENTICATED' })
    );
    expect(f.emits).toHaveLength(0);
  });
});

/**
 * F11 join pump edges: dead sockets skipped, long tails paged, live mapping.
 */
describe('GameGateway join pump edges (F11)', () => {
  it('replays a >20 tail fully instead of truncating silently (M6)', async () => {
    const { gateway } = makeGateway(false);
    const gw = gateway as any;
    const roomEmits: { event: string; payload: unknown }[] = [];
    gw.server = {
      sockets: { sockets: { get: () => undefined }, adapter: { rooms: { get: () => undefined } } },
      to: () => ({ emit: (event: string, payload: unknown) => roomEmits.push({ event, payload }) }),
    };
    gw.gameService.createGame({
      gameId: 'jp-long',
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
    const resubmit = vi.spyOn(gw.gameService, 'resubmitAction');
    const pendings = Array.from({ length: 25 }, (_, i) => ({
      clientActionId: `long-${i}`,
      action: { type: 'MOVE', to: { row: 7, col: 4 } },
    }));
    try {
      gw.handleJoinGame(client, { gameId: 'jp-long', lastSequence: 0, pendingActions: pendings });
      await new Promise((r) => setTimeout(r, 50));
      // Paginated, not truncated at 20: every entry offered to validation.
      expect(resubmit).toHaveBeenCalledTimes(25);
      expect(syncs).toHaveLength(1);
    } finally {
      const game = gw.gameService.getGame('jp-long');
      if (game?.timerInterval) clearInterval(game.timerInterval);
      if (game?.quorumTimeout) clearTimeout(game.quorumTimeout);
      if (game?.flagTimeout) clearTimeout(game.flagTimeout);
      if (game) for (const t of game.afkTimers.values()) clearTimeout(t);
    }
  });
});