import { GameMode, playerCountForMode } from '@duoorb/game-core';
import { RoomDto, RoomInviteDto, RoomSlot } from '@duoorb/protocol';

export class RoomService {
  private rooms = new Map<string, RoomDto>();
  private codeToId = new Map<string, string>();
  private invites = new Map<string, RoomInviteDto>();

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public createRoom(
    hostId: string,
    hostDisplayName: string,
    mode: GameMode,
    timeControlMinutes: number,
    incrementSeconds = 0,
    wallsEach = 10
  ): RoomDto {
    const id = `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const code = this.generateCode();
    const slotCount = playerCountForMode(mode);

    const slots: RoomSlot[] = Array.from({ length: slotCount }).map((_, idx) => ({
      index: idx,
      userId: idx === 0 ? hostId : null,
      displayName: idx === 0 ? hostDisplayName : null,
      isReady: idx === 0,
      isHost: idx === 0,
    }));

    const room: RoomDto = {
      id,
      code,
      mode,
      hostId,
      creatorId: hostId,
      slots,
      timeControlMinutes,
      incrementSeconds,
      wallsEach: Math.max(0, Math.min(99, Math.floor(wallsEach))),
      status: 'WAITING',
      createdAt: Date.now(),
    };

    this.rooms.set(id, room);
    this.codeToId.set(code, id);
    return room;
  }

  public getRoomByCode(code: string): RoomDto | undefined {
    const id = this.codeToId.get(code.toUpperCase());
    if (!id) return undefined;
    return this.rooms.get(id);
  }

  public getRoom(id: string): RoomDto | undefined {
    return this.rooms.get(id);
  }

  public joinRoom(
    code: string,
    userId: string,
    displayName: string
  ): { success: true; room: RoomDto } | { success: false; error: string } {
    const room = this.getRoomByCode(code);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.status !== 'WAITING') return { success: false, error: 'Room is already in a game.' };

    const existingSlot = room.slots.find((s) => s.userId === userId);
    if (existingSlot) {
      this.restoreCreatorHost(room, userId);
      return { success: true, room };
    }

    const emptySlot = room.slots.find((s) => s.userId === null);
    if (!emptySlot) {
      return { success: false, error: 'Room is full.' };
    }

    emptySlot.userId = userId;
    emptySlot.displayName = displayName;
    emptySlot.isReady = false;

    this.restoreCreatorHost(room, userId);
    return { success: true, room };
  }

  /**
   * The room creator always gets the host crown back when they (re)join —
   * leaving or reloading must never permanently demote the owner.
   */
  private restoreCreatorHost(room: RoomDto, userId: string): void {
    if (room.status !== 'WAITING') return;
    if (room.hostId === userId) return;
    const creatorSlot = room.slots.find((s) => s.userId === room.creatorId);
    if (!creatorSlot || creatorSlot.userId !== userId) return;
    const currentHost = room.slots.find((s) => s.isHost);
    if (currentHost) {
      currentHost.isHost = false;
      currentHost.isReady = false;
    }
    creatorSlot.isHost = true;
    creatorSlot.isReady = true;
    room.hostId = userId;
  }

  public createInvite(
    roomId: string,
    fromUserId: string,
    toUserId: string
  ): { success: true; invite: RoomInviteDto } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.status !== 'WAITING') return { success: false, error: 'Game already started.' };
    if (room.hostId !== fromUserId) return { success: false, error: 'Only the host can invite players.' };
    if (room.slots.some((slot) => slot.userId === toUserId)) {
      return { success: false, error: 'Player is already in this room.' };
    }
    if (!room.slots.some((slot) => slot.userId === null)) {
      return { success: false, error: 'Room is full.' };
    }
    for (const invite of this.invites.values()) {
      if (invite.roomId === roomId && invite.toUserId === toUserId) {
        return { success: true, invite };
      }
    }
    const invite: RoomInviteDto = {
      inviteId: `room-invite-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      roomId,
      code: room.code,
      fromUserId,
      fromDisplayName: '',
      toUserId,
      createdAt: Date.now(),
    };
    this.invites.set(invite.inviteId, invite);
    return { success: true, invite };
  }

  public respondInvite(
    inviteId: string,
    userId: string,
    displayName: string,
    accept: boolean
  ): { success: true; room: RoomDto | null; invite: RoomInviteDto } | { success: false; error: string } {
    const invite = this.invites.get(inviteId);
    if (!invite) return { success: false, error: 'Invite not found or expired.' };
    if (invite.toUserId !== userId) return { success: false, error: 'Invite is not for this player.' };
    if (!accept) {
      this.invites.delete(inviteId);
      return { success: true, room: null, invite };
    }
    const joined = this.joinRoom(invite.code, userId, displayName);
    if (!joined.success) return { success: false, error: joined.error };
    this.invites.delete(inviteId);
    return { success: true, room: joined.room, invite };
  }

  /**
   * Readiness means "this player is in the lobby right now", so it can only be
   * changed while the room is actually waiting. A player sitting on a board
   * cannot re-arm a room that is running.
   */
  public setReady(roomId: string, userId: string, isReady: boolean): RoomDto | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'WAITING') return room;

    const slot = room.slots.find((s) => s.userId === userId);
    if (slot && !slot.isHost) {
      slot.isReady = isReady;
    }
    return room;
  }

  /**
   * Disarms everyone who just left the lobby for a board. Readiness is a
   * property of being in the lobby, so starting a game must consume it —
   * otherwise a stale "ready" survives the match and lets the host start
   * again with players who are still on the previous board.
   *
   * The host keeps their flag: the host has no ready toggle (they get the
   * Start button instead), so their readiness is implicit and is re-armed
   * whenever the room returns to the lobby.
   */
  private disarmOnStart(room: RoomDto): void {
    for (const slot of room.slots) {
      if (slot.userId !== null) slot.isReady = slot.isHost;
    }
  }

  /**
   * Puts a finished room back in the lobby so the same table can play again.
   * Only non-host readiness is cleared: everyone must re-confirm they are
   * actually here before the host can start a second game.
   */
  public returnToLobby(roomId: string): RoomDto | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.status = 'WAITING';
    for (const slot of room.slots) {
      if (slot.userId !== null) slot.isReady = slot.isHost;
    }
    return room;
  }

  public leaveRoom(roomId: string, userId: string): { room: RoomDto | null; disbanded: boolean } {    const room = this.rooms.get(roomId);
    if (!room) return { room: null, disbanded: false };

    const slotIndex = room.slots.findIndex((s) => s.userId === userId);
    if (slotIndex === -1) return { room, disbanded: false };

    const wasHost = room.slots[slotIndex].isHost;
    room.slots[slotIndex].userId = null;
    room.slots[slotIndex].displayName = null;
    room.slots[slotIndex].isReady = false;
    room.slots[slotIndex].isHost = false;

    // Check remaining players
    const remainingSlots = room.slots.filter((s) => s.userId !== null);
    if (remainingSlots.length === 0) {
      this.rooms.delete(roomId);
      this.codeToId.delete(room.code);
      return { room: null, disbanded: true };
    }

    // If host left, assign host to first remaining player
    if (wasHost) {
      const newHostSlot = remainingSlots[0];
      newHostSlot.isHost = true;
      newHostSlot.isReady = true;
      room.hostId = newHostSlot.userId!;
    }

    return { room, disbanded: false };
  }

  /**
   * One identity, one migration: when a guest signs in mid-flow their socket
   * id changes from the guest id to the account id. Move every live
   * reference (slots, host, creator) so seats and crowns survive sign-in.
   * Returns the touched rooms so callers can rebroadcast them.
   */
  public migrateUser(oldUserId: string, newUserId: string, displayName: string): RoomDto[] {
    if (oldUserId === newUserId) return [];
    const touched: RoomDto[] = [];
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const slot of room.slots) {
        if (slot.userId === oldUserId) {
          slot.userId = newUserId;
          slot.displayName = displayName;
          changed = true;
        }
      }
      if (room.hostId === oldUserId) {
        room.hostId = newUserId;
        changed = true;
      }
      if (room.creatorId === oldUserId) {
        room.creatorId = newUserId;
        changed = true;
      }
      if (changed) touched.push(room);
    }
    return touched;
  }
  public kickPlayer(
    roomId: string,
    hostUserId: string,
    targetUserId: string
  ): { success: true; room: RoomDto | null } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.status !== 'WAITING') return { success: false, error: 'Game already started.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Only the host can kick players.' };
    if (targetUserId === hostUserId) return { success: false, error: 'You cannot kick yourself.' };

    const slot = room.slots.find((s) => s.userId === targetUserId);
    if (!slot) return { success: false, error: 'Player is not in this room.' };

    slot.userId = null;
    slot.displayName = null;
    slot.isReady = false;

    return { success: true, room };
  }

  public startRoom(
    roomId: string,
    hostUserId: string
  ): { success: true; room: RoomDto; players: { userId: string; displayName: string }[] } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Only the host can start the room.' };
    // A room that is already running must never start a second game: its
    // seats are still occupied by players on the previous board.
    if (room.status !== 'WAITING') {
      return { success: false, error: 'This room already started a game.' };
    }

    const occupiedSlots = room.slots.filter((s) => s.userId !== null);
    const requiredPlayers = playerCountForMode(room.mode);

    if (occupiedSlots.length < requiredPlayers) {
      return { success: false, error: `Waiting for ${requiredPlayers - occupiedSlots.length} more player(s).` };
    }

    const allReady = occupiedSlots.every((s) => s.isReady);
    if (!allReady) {
      return { success: false, error: 'All players must be ready before starting.' };
    }

    room.status = 'IN_GAME';
    // Everyone leaves the lobby the moment the game starts, so nobody counts
    // as ready while sitting on a board.
    this.disarmOnStart(room);
    const players = occupiedSlots.map((s) => ({
      userId: s.userId!,
      displayName: s.displayName!,
    }));

    return { success: true, room, players };
  }
}
