import { describe, expect, it } from 'vitest';
import { RoomService } from '../src/rooms/room.service.js';

describe('Room Lifecycle Service', () => {
  it('creates room with mode, time control, and increment', () => {
    const service = new RoomService();
    const room = service.createRoom('host-1', 'HostAlice', '2p', 5, 3);

    expect(room.id).toBeDefined();
    expect(room.code).toHaveLength(6);
    expect(room.hostId).toBe('host-1');
    expect(room.slots).toHaveLength(2);
    expect(room.slots[0].isHost).toBe(true);
    expect(room.slots[0].isReady).toBe(true);
    expect(room.slots[1].userId).toBeNull();
    expect(room.timeControlMinutes).toBe(5);
    expect(room.incrementSeconds).toBe(3);
  });

  it('handles guest joining, readying up, and start validation', () => {
    const service = new RoomService();
    const room = service.createRoom('host-1', 'HostAlice', '2p', 3, 0);

    // Guest Bob joins
    const joinRes = service.joinRoom(room.code, 'guest-bob', 'Bob');
    expect(joinRes.success).toBe(true);
    if (!joinRes.success) return;

    expect(joinRes.room.slots[1].userId).toBe('guest-bob');
    expect(joinRes.room.slots[1].isReady).toBe(false);

    // Starting while guest not ready should fail
    const prematureStart = service.startRoom(room.id, 'host-1');
    expect(prematureStart.success).toBe(false);

    // Guest readies up
    service.setReady(room.id, 'guest-bob', true);

    // Start now succeeds
    const startRes = service.startRoom(room.id, 'host-1');
    expect(startRes.success).toBe(true);
    if (!startRes.success) return;

    expect(startRes.room.status).toBe('IN_GAME');
    expect(startRes.players).toHaveLength(2);
    expect(startRes.players[0].userId).toBe('host-1');
    expect(startRes.players[1].userId).toBe('guest-bob');
  });

  it('handles leave room with host transfer and room disband', () => {
    const service = new RoomService();
    const room = service.createRoom('host-1', 'Alice', '2p', 3, 0);
    service.joinRoom(room.code, 'guest-bob', 'Bob');

    // Host leaves -> Bob becomes host
    const leave1 = service.leaveRoom(room.id, 'host-1');
    expect(leave1.disbanded).toBe(false);
    expect(leave1.room?.hostId).toBe('guest-bob');
    expect(leave1.room?.slots[1].isHost).toBe(true);

    // Bob leaves -> Room empty and disbanded
    const leave2 = service.leaveRoom(room.id, 'guest-bob');
    expect(leave2.disbanded).toBe(true);
    expect(leave2.room).toBeNull();
  });
});

/**
 * Regression: readiness used to mean "tapped ready once", not "is in the
 * lobby". A host returning to the lobby from a finished match saw the stale
 * ready flags, started again, and got a rated game containing only himself
 * while the opponent was still on the previous board.
 */
describe('Room readiness means being in the lobby', () => {
  function seatedRoom() {
    const service = new RoomService();
    const room = service.createRoom('host-1', 'HostAlice', '2p', 3, 0);
    service.joinRoom(room.code, 'guest-bob', 'Bob');
    service.setReady(room.id, 'guest-bob', true);
    return { service, room };
  }

  it('consumes readiness when the game starts', () => {
    const { service, room } = seatedRoom();

    const started = service.startRoom(room.id, 'host-1');
    expect(started.success).toBe(true);

    // Nobody is in the lobby any more, so nobody counts as ready.
    expect(service.getRoom(room.id)!.status).toBe('IN_GAME');
    expect(service.getRoom(room.id)!.slots[0].isReady).toBe(true); // host: implicit
    expect(service.getRoom(room.id)!.slots[1].isReady).toBe(false); // guest: disarmed
  });

  it('refuses to start a second game while the room is running one', () => {
    const { service, room } = seatedRoom();
    expect(service.startRoom(room.id, 'host-1').success).toBe(true);

    // The host comes back to the lobby and taps Start again.
    const again = service.startRoom(room.id, 'host-1');
    expect(again.success).toBe(false);
    if (again.success) return;
    expect(again.error).toMatch(/already started/i);
  });

  it('refuses readiness changes while the room is running a game', () => {
    const { service, room } = seatedRoom();
    service.startRoom(room.id, 'host-1');

    // The guest, still sitting on the board, tries to ready up in the lobby.
    service.setReady(room.id, 'guest-bob', true);
    expect(service.getRoom(room.id)!.slots[1].isReady).toBe(false);
  });

  it('requires a fresh ready-up after returning to the lobby', () => {
    const { service, room } = seatedRoom();
    service.startRoom(room.id, 'host-1');

    const back = service.returnToLobby(room.id);
    expect(back).not.toBeNull();
    expect(back!.status).toBe('WAITING');
    // The guest must confirm they are actually here this time.
    expect(back!.slots[1].isReady).toBe(false);

    const premature = service.startRoom(room.id, 'host-1');
    expect(premature.success).toBe(false);

    service.setReady(room.id, 'guest-bob', true);
    expect(service.startRoom(room.id, 'host-1').success).toBe(true);
  });

  it('re-arms the host implicitly when the room returns to the lobby', () => {
    const { service, room } = seatedRoom();
    service.startRoom(room.id, 'host-1');

    const back = service.returnToLobby(room.id)!;
    // The host has no ready toggle in the UI, so theirs stays set.
    expect(back.slots[0].isReady).toBe(true);
    expect(back.slots[0].isHost).toBe(true);
  });

  it('keeps disarming non-hosts when the host leaves mid-game', () => {
    const { service, room } = seatedRoom();
    service.startRoom(room.id, 'host-1');

    // Host leaves the room while the game runs: the guest is promoted.
    const left = service.leaveRoom(room.id, 'host-1');
    expect(left.room?.hostId).toBe('guest-bob');
    // A promoted host is implicitly ready, and the room is back to waiting.
    expect(left.room?.slots[1].isReady).toBe(true);
  });
});
