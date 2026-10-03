import { GameMode, playerCountForMode } from '@duoorb/game-core';
import { RoomDto, RoomInviteDto, RoomSlot } from '@duoorb/protocol';

/**
 * Fisher-Yates shuffle returning a new array. Used when a room starts so
 * seat order (colors + first move) is random every match instead of
 * slot order, where the host would always be blue and always start first.
 */
export function shuffleSeats<T>(seats: T[]): T[] {
  const out = [...seats];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class RoomService {
  private rooms = new Map<string, RoomDto>();
  private codeToId = new Map<string, string>();
  private invites = new Map<string, RoomInviteDto>();
  private inviteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Lobby invites live 5 minutes, then die silently. Challenges get 30s
   * because both ends stare at a toast; invites wait on a friend who may be
   * mid-game, so they get room to breathe — but never forever.
   */
  public static readonly INVITE_TTL_MS = 5 * 60_000;

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

  /**
   * Identity re-sync: a player chose or edited their name after joining.
   * Refreshes every slot (and pending invite sender label) carrying their
   * user id so lobbies stop showing the stale handshake name. Returns the
   * ids of rooms whose visible state changed, for re-broadcast.
   */
  public refreshDisplayName(userId: string, displayName: string): string[] {
    const touched = new Set<string>();
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const slot of room.slots) {
        if (slot.userId === userId && slot.displayName !== displayName) {
          slot.displayName = displayName;
          changed = true;
        }
      }
      if (changed) touched.add(room.id);
    }
    for (const invite of this.invites.values()) {
      if (invite.fromUserId === userId) invite.fromDisplayName = displayName;
    }
    return [...touched];
  }

  public createInvite(    roomId: string,
    fromUserId: string,
    toUserId: string
  ): { success: true; invite: RoomInviteDto } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.status !== 'WAITING') return { success: false, error: 'Game already started.' };
    // Any seated member can invite from their own friends — not just the
    // host. The invite still targets one open slot and one offline-checked
    // friend, so a member can never overfill or hijack the lobby.
    if (!room.slots.some((slot) => slot.userId === fromUserId)) {
      return { success: false, error: 'Only room members can invite players.' };
    }
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
      expiresAt: Date.now() + RoomService.INVITE_TTL_MS,
    };
    this.invites.set(invite.inviteId, invite);
    const timer = setTimeout(() => {
      this.invites.delete(invite.inviteId);
      this.inviteTimers.delete(invite.inviteId);
    }, RoomService.INVITE_TTL_MS);
    // Lobby furniture must never hold the process open.
    if (typeof (timer as unknown as { unref?: unknown }).unref === 'function') {
      (timer as unknown as { unref: () => void }).unref();
    }
    this.inviteTimers.set(invite.inviteId, timer);
    return { success: true, invite };
  }

  private clearInvite(inviteId: string): void {
    this.invites.delete(inviteId);
    const timer = this.inviteTimers.get(inviteId);
    if (timer) clearTimeout(timer);
    this.inviteTimers.delete(inviteId);
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
    if (Date.now() > invite.expiresAt) {
      this.clearInvite(inviteId);
      return { success: false, error: 'Invite expired.' };
    }
    if (!accept) {
      this.clearInvite(inviteId);
      return { success: true, room: null, invite };
    }
    const joined = this.joinRoom(invite.code, userId, displayName);
    if (!joined.success) return { success: false, error: joined.error };
    this.clearInvite(inviteId);
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
   * Host-only setup edit from the lobby (mode, clock, walls) so a table can
   * switch from Center Rush to Race without disbanding and re-inviting.
   * WAITING rooms only; a running game keeps the config it started with.
   *
   * Changing the player count resizes the seats: occupants keep their order
   * with the host pinned to slot 0, empties pad the rest. Shrinking below the
   * seated headcount fails instead of evicting anyone silently. Any change
   * disarms non-host readiness — a ready flag given for 2P Classic is not
   * consent for 4P Race.
   */
  public configureRoom(
    roomId: string,
    hostUserId: string,
    patch: { mode?: GameMode; timeControlMinutes?: number; incrementSeconds?: number; wallsEach?: number }
  ): { success: true; room: RoomDto } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Only the host can change the setup.' };
    if (room.status !== 'WAITING') return { success: false, error: 'This room already started a game.' };

    const VALID_MODES: GameMode[] = ['2p', '4p', 'race2', 'race3', 'race4', 'center2', 'center3'];
    if (patch.mode !== undefined) {
      if (!VALID_MODES.includes(patch.mode)) return { success: false, error: 'Unknown game mode.' };
    }
    if (patch.timeControlMinutes !== undefined) {
      if (!Number.isInteger(patch.timeControlMinutes) || patch.timeControlMinutes < 0 || patch.timeControlMinutes > 30) {
        return { success: false, error: 'Clock must be 0–30 minutes.' };
      }
    }
    if (patch.incrementSeconds !== undefined) {
      if (!Number.isInteger(patch.incrementSeconds) || patch.incrementSeconds < 0 || patch.incrementSeconds > 60) {
        return { success: false, error: 'Increment must be 0–60 seconds.' };
      }
    }
    if (patch.wallsEach !== undefined) {
      if (!Number.isInteger(patch.wallsEach) || patch.wallsEach < 0 || patch.wallsEach > 99) {
        return { success: false, error: 'Walls must be 0–99.' };
      }
    }

    let disarmed = false;
    if (patch.mode !== undefined && patch.mode !== room.mode) {
      const newCount = playerCountForMode(patch.mode);
      const occupants = room.slots.filter((s) => s.userId !== null);
      if (occupants.length > newCount) {
        return {
          success: false,
          error: `${occupants.length} players are seated — that mode only fits ${newCount}.`,
        };
      }
      const host = occupants.find((s) => s.userId === room.hostId) ?? occupants[0];
      const rest = occupants.filter((s) => s !== host);
      room.slots = Array.from({ length: newCount }).map((_, idx) => {
        if (idx === 0 && host) {
          return { index: 0, userId: host.userId, displayName: host.displayName, isReady: true, isHost: true };
        }
        const next = rest[idx - 1];
        return {
          index: idx,
          userId: next?.userId ?? null,
          displayName: next?.displayName ?? null,
          isReady: false,
          isHost: false,
        };
      });
      room.mode = patch.mode;
      disarmed = true;
    }
    if (patch.timeControlMinutes !== undefined && patch.timeControlMinutes !== room.timeControlMinutes) {
      room.timeControlMinutes = patch.timeControlMinutes;
      disarmed = true;
    }
    if (patch.incrementSeconds !== undefined && patch.incrementSeconds !== room.incrementSeconds) {
      room.incrementSeconds = patch.incrementSeconds;
      disarmed = true;
    }
    if (patch.wallsEach !== undefined && patch.wallsEach !== room.wallsEach) {
      room.wallsEach = Math.max(0, Math.min(99, Math.floor(patch.wallsEach)));
      disarmed = true;
    }

    if (disarmed) {
      for (const slot of room.slots) {
        if (slot.userId !== null) slot.isReady = slot.isHost;
      }
    }
    return { success: true, room };
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
      // Disbanded rooms take their invites with them: answering one would
      // only fail against a room that no longer exists.
      for (const [id, invite] of this.invites) {
        if (invite.roomId === roomId) this.clearInvite(id);
      }
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
  /**
   * Removes a disconnected user from every WAITING lobby they sit in
   * (host crown hands over, empty rooms disband with their invites).
   * IN_GAME rooms are untouched: a mid-match blip must not eject the seat
   * from its own lobby — grace covers the absence and the room is still
   * theirs on return. Returns per-room outcomes for rebroadcast.
   */
  public leaveAllWaitingRooms(
    userId: string
  ): { roomId: string; room: RoomDto | null; disbanded: boolean }[] {
    const out: { roomId: string; room: RoomDto | null; disbanded: boolean }[] = [];
    for (const room of this.rooms.values()) {
      if (room.status !== 'WAITING') continue;
      if (!room.slots.some((s) => s.userId === userId)) continue;
      const { room: after, disbanded } = this.leaveRoom(room.id, userId);
      out.push({ roomId: room.id, room: after, disbanded });
    }
    return out;
  }

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
