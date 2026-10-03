import { describe, it, expect, vi, afterEach } from 'vitest';
import { RoomService, shuffleSeats } from './room.service.js';

function makeRoom(svc: RoomService, mode: '2p' | 'race3' | 'race4' = '2p') {
  return svc.createRoom('host1', 'Host', mode, 3, 0, 10);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('configureRoom', () => {
  it('lets the host change clock and walls without touching seats', () => {
    const svc = new RoomService();
    const room = makeRoom(svc);
    const res = svc.configureRoom(room.id, 'host1', {
      timeControlMinutes: 5,
      incrementSeconds: 3,
      wallsEach: 15,
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.room.timeControlMinutes).toBe(5);
    expect(res.room.incrementSeconds).toBe(3);
    expect(res.room.wallsEach).toBe(15);
    expect(res.room.slots).toHaveLength(2);
    expect(res.room.slots[0].userId).toBe('host1');
  });

  it('rejects non-hosts, unknown rooms and live games', () => {
    const svc = new RoomService();
    const room = makeRoom(svc);
    expect(svc.configureRoom(room.id, 'stranger', { wallsEach: 5 }).success).toBe(false);
    expect(svc.configureRoom('nope', 'host1', { wallsEach: 5 }).success).toBe(false);
    room.status = 'IN_GAME';
    expect(svc.configureRoom(room.id, 'host1', { wallsEach: 5 }).success).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const svc = new RoomService();
    const room = makeRoom(svc);
    expect(svc.configureRoom(room.id, 'host1', { mode: 'nope' as never }).success).toBe(false);
    expect(svc.configureRoom(room.id, 'host1', { timeControlMinutes: 99 }).success).toBe(false);
    expect(svc.configureRoom(room.id, 'host1', { incrementSeconds: -1 }).success).toBe(false);
    expect(svc.configureRoom(room.id, 'host1', { wallsEach: 100 }).success).toBe(false);
  });

  it('grows seats on mode change, host pinned to slot 0', () => {
    const svc = new RoomService();
    const room = makeRoom(svc, '2p');
    room.slots[1] = { index: 1, userId: 'u2', displayName: 'Two', isReady: true, isHost: false };
    const res = svc.configureRoom(room.id, 'host1', { mode: 'race4' });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.room.mode).toBe('race4');
    expect(res.room.slots).toHaveLength(4);
    expect(res.room.slots[0].userId).toBe('host1');
    expect(res.room.slots[0].isHost).toBe(true);
    expect(res.room.slots[1].userId).toBe('u2');
    // Ready flags are re-earned after any setup change.
    expect(res.room.slots[1].isReady).toBe(false);
  });

  it('refuses to shrink below the seated headcount instead of evicting', () => {
    const svc = new RoomService();
    const room = makeRoom(svc, 'race4');
    room.slots[1] = { index: 1, userId: 'u2', displayName: 'Two', isReady: true, isHost: false };
    room.slots[2] = { index: 2, userId: 'u3', displayName: 'Three', isReady: true, isHost: false };
    const res = svc.configureRoom(room.id, 'host1', { mode: '2p' });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toMatch(/seated/);
    // Untouched by the failed edit.
    expect(svc.getRoom(room.id)?.mode).toBe('race4');
  });
});

describe('shuffleSeats', () => {
  it('preserves every element and returns a new array', () => {
    const src = ['a', 'b', 'c', 'd'];
    const out = shuffleSeats(src);
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(out).not.toBe(src);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('actually varies first seat across matches', () => {
    const firsts = new Set<string>();
    for (let i = 0; i < 50; i++) firsts.add(shuffleSeats(['h', 'a', 'b', 'c'])[0]);
    // P(all 50 identical) = (1/4)^49 — a failure here means no shuffle.
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe('invite lifecycle + disconnect hygiene (F10)', () => {
  it('invites carry an expiry and die on their own timer', () => {
    vi.useFakeTimers();
    const svc = new RoomService();
    const room = makeRoom(svc);
    const res = svc.createInvite(room.id, 'host1', 'u2');
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.invite.expiresAt).toBeGreaterThan(Date.now());
    expect((svc as any).invites.size).toBe(1);
    vi.advanceTimersByTime(RoomService.INVITE_TTL_MS + 1000);
    expect((svc as any).invites.size).toBe(0);
    // Answering late fails instead of joining a ghost.
    expect(svc.respondInvite(res.invite.inviteId, 'u2', 'Two', true).success).toBe(false);
  });

  it('disbanding a room cascades to its invites', () => {
    const svc = new RoomService();
    const room = makeRoom(svc);
    svc.createInvite(room.id, 'host1', 'u2');
    expect((svc as any).invites.size).toBe(1);
    // Last seat leaves: room disbands, invites die with it.
    const left = svc.leaveRoom(room.id, 'host1');
    expect(left.disbanded).toBe(true);
    expect((svc as any).invites.size).toBe(0);
  });

  it('leaveAllWaitingRooms frees lobbies but never live games', () => {
    const svc = new RoomService();
    const lobby = makeRoom(svc);
    svc.joinRoom(lobby.code, 'u2', 'Two');
    const live = svc.createRoom('host1', 'Host', '2p', 3, 0, 10);
    svc.joinRoom(live.code, 'u9', 'Nine');
    live.status = 'IN_GAME';

    const out = svc.leaveAllWaitingRooms('u2');
    expect(out).toHaveLength(1);
    expect(out[0].disbanded).toBe(false);
    // u9's live seat is untouched.
    const liveAfter = (svc as any).rooms.get(live.id);
    expect(liveAfter.slots.some((s: any) => s.userId === 'u9')).toBe(true);
  });

  it('a disconnecting host hands the crown to the next seat', () => {
    const svc = new RoomService();
    const lobby = makeRoom(svc);
    svc.joinRoom(lobby.code, 'u2', 'Two');
    const out = svc.leaveAllWaitingRooms('host1');
    expect(out).toHaveLength(1);
    expect(out[0].room?.hostId).toBe('u2');
    expect(out[0].room?.status).toBe('WAITING');
  });
});
