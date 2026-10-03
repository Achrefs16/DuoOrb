import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
// `Ack` exists in @nestjs/websockets 10.4 but is NOT re-exported from the
// package root (decorators/index.d.ts omits it), so it is imported from its
// own module. Deep import is safe: the package declares no `exports` map.
import { Ack } from '@nestjs/websockets/decorators/ack.decorator';
import { Server, Socket } from 'socket.io';
import type { ActionAck } from '@duoorb/protocol';
import { GameAction, GameMode, RecordedAction } from '@duoorb/game-core';
import { AuthoritativeGameService } from '../game/authoritative-game.service.js';
import { AiwinsService } from '../aiwins/aiwins.service.js';
import { MatchmakingService, type MatchmakingRequest } from '../matchmaking/matchmaking.service.js';
import { GuestService } from '../guest/guest.service.js';
import { resolveCorsOrigins } from '../config/cors.js';
import { RoomService, shuffleSeats } from '../rooms/room.service.js';
import { ChallengeService } from '../challenge/challenge.service.js';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Logger } from '@nestjs/common';
import { ClockStateDto, GameEndedDto, RoomDto } from '@duoorb/protocol';

interface SocketUserInfo {
  userId: string;
  displayName: string;
  /** The single universal DuoOrb rating (all ranked modes share it). */
  rating: number;
  /**
   * True only after the socket's token verified (dev prefix parse or
   * Supabase JWKS). Query-supplied ids alone NEVER authorize mutations —
   * otherwise any client could impersonate any userId with no credential.
   * Note: dev guest tokens are self-asserted by design (unguessable random
   * ids are the capability); Google JWTs are cryptographically verified.
   */
  verified: boolean;
}

/** The six quick-reaction kinds. Mirrors the mobile `ReactionKind` union. */
const REACTION_KINDS = new Set(['laugh', 'wow', 'cry', 'angry', 'clap', 'fire']);
/** Minimum ms between relays from one socket: absorbs tap floods. */
const REACTION_THROTTLE_MS = 500;

@WebSocketGateway({
  // Same allowlist as the HTTP API so the two cannot drift. Resolved at module
  // load, which is after dotenv has populated process.env.
  cors: resolveCorsOrigins(),
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  private gameService!: AuthoritativeGameService;
  private roomService = new RoomService();
  private challengeService = new ChallengeService();
  private matchmakingService = new MatchmakingService();
  /**
   * Join-pump bookkeeping (see handleJoinGame): the latest unprocessed join
   * per game + user, and which keys currently have a pump running. Lets
   * reconnect bursts collapse into a single replay + sync instead of one
   * per emitted join.
   */
  private joinLatest = new Map<
    string,
    {
      client: Socket;
      payload: {
        gameId: string;
        lastSequence?: number;
        pendingActions?: { clientActionId: string; action: GameAction }[];
      };
      seat: string;
    }
  >();
  private joinActive = new Set<string>();
  private socketUserMap = new Map<string, SocketUserInfo>(); // socketId -> SocketUserInfo
  private userSocketMap = new Map<string, string>();         // userId -> socketId
  private activeGameUserMap = new Map<string, string>();     // userId -> gameId
  /** gameId -> roomId, for games created from a private room lobby. Lets the
   * room be handed back to its lobby when that game finishes. */
  private gameRoomMap = new Map<string, string>();
  private sweepInterval?: NodeJS.Timeout;
  /** Per-seat ping throttle (gameId:userId → last accepted sample). */
  private pingThrottle = new Map<string, number>();
  /** Last-known live rating per user: lobby fallback when no live socket. */
  private userRatingCache = new Map<string, number>();
  /** Last reaction timestamp per socket, for the tap-flood throttle. */
  private reactionLastAt = new Map<string, number>();

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly guestService?: GuestService
  ) {
    this.gameService = new AuthoritativeGameService(this.prisma, new AiwinsService(this.prisma));
  }

  /** Housekeeping must not outlive the module (tests, HMR, restarts). */
  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = undefined;
    }
  }

  afterInit() {    // 2-second periodic sweep for matchmaking queue
    this.sweepInterval = setInterval(() => {
      this.runMatchmakingSweep();
    }, 2000);
    if (typeof this.sweepInterval.unref === 'function') {
      this.sweepInterval.unref();
    }
    this.logger.log('GameGateway initialized with 2s matchmaking sweep loop.');

    // Crash recovery: rebuild every IN_PROGRESS game from Postgres through
    // game-core replay, restart their clocks. Unreconstructable games are
    // marked ABANDONED with reasons — never invented.
    void this.gameService
      .recoverInProgressGames({
onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
        onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
        onAfkWarning: (gId, payload) => this.server.to(gId).emit('game:afkWarning', payload),
        onForfeit: (gId, ended, finished, move) =>
          this.emitMidGameForfeit(gId, ended, finished, move),
      })
      .then(({ recovered, abandoned }) => {
        this.logger.log(`Startup recovery: ${recovered} recovered, ${abandoned.length} abandoned.`);
      })
      .catch((err) => {
        this.logger.error(`Startup recovery failed: ${err?.message}`);
      });
  }

  async handleConnection(client: Socket) {
    // Register synchronously FIRST so no message can ever arrive before
    // the maps know this socket. The entry starts UNVERIFIED under an
    // opaque per-socket handle and is only upgraded below by a credential
    // the server itself verifies — never by client-asserted query fields.
    const qName = client.handshake.query?.displayName as string | undefined;
    const earlyId = `anon-${client.id.substring(0, 6)}`;
    this.socketUserMap.set(client.id, {
      userId: earlyId,
      displayName: qName ?? `Player ${client.id.substring(0, 4)}`,
      rating: 1500,
      verified: false,
    });
    this.userSocketMap.set(earlyId, client.id);
    this.matchmakingService.updateSocket(earlyId, client.id);

    // Guest access tokens verify with a local HMAC (no I/O), so they are
    // resolved first and treated as AUTHORITATIVE. Account JWTs go through
    // Supabase's JWKS below, which is a network round trip.
    const rawToken =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization?.replace('Bearer ', '') as string) ||
      (client.handshake.query?.token as string);

    let userId: string | null = null;
    let displayName = qName ?? `Player ${client.id.substring(0, 4)}`;
    let rating = 1500;
    let verified = false;

    if (rawToken) {
      const guestUserId = this.guestService?.verifyAccessToken(rawToken) ?? null;
      if (guestUserId) {
        userId = guestUserId;
        verified = true;
      }
    }

    // Second pass: provisioning first, identity adoption second.
    // verifyToken accepts guest HMACs as well as Supabase JWTs, and
    // getOrCreateUser recreates any rows a valid credential lost (e.g.
    // the database was wiped while its tokens stayed valid) — creating
    // nothing for anyone who already has rows. Adopting the verified
    // identity stays gated on !verified: this must NEVER downgrade an
    // already-verified guest.
    if (rawToken) {
      try {
        const claims = await this.authService.verifyToken(rawToken);
        const provisioned = await this.authService.getOrCreateUser(claims);
        // Postgres is the ONLY source of truth for a player's name. `provisioned`
        // is already computed here for every credential, so use it — assigning
        // it only when !verified left every guest carrying the name the device
        // asserted in the handshake query. That value was then snapshotted by
        // matchmaking:find, frozen into the game by createGame, and persisted
        // into history, so the same player appeared under different names in
        // the friend list (which reads the database) and in every match.
        //
        // `username` is the canonical display name: it is unique, user-chosen
        // and never auto-generated, whereas displayName is seeded with a random
        // handle for new guests and is often left at that value.
        const canonicalName = provisioned.username || provisioned.displayName;
        if (canonicalName) displayName = canonicalName;
        if (!verified) {
          userId = provisioned.id;
          verified = true;
        }
      } catch {
        this.logger.warn(`No Supabase identity on ${client.id}; staying unverified.`);
      }
    }

    // Unverified callers keep an opaque per-socket handle. The
    // client-asserted query.userId is untrusted input: it must never
    // become identity, presence, or matchmaking state.
    const effectiveId = userId ?? earlyId;

    // Fetch the universal rating if DB is available
    if (this.prisma.isConnected && verified) {
      try {
        const ratingRecord = await this.prisma.rating.findUnique({
          where: { userId: effectiveId },
        });
        if (ratingRecord) {
          rating = Math.round(ratingRecord.rating);
        }
      } catch (err: any) {
        this.logger.warn(`Rating lookup failed for ${effectiveId}: ${err?.message}`);
      }
    }

    try {
      // A newer connection may have superseded this one while awaiting.
      if (client.disconnected) {
        return;
      }
      const userInfo: SocketUserInfo = { userId: effectiveId, displayName, rating, verified };
      this.socketUserMap.set(client.id, userInfo);
      this.userSocketMap.delete(earlyId);
      // Single controlling session: if a different LIVE socket already spoke
      // for this user, it is now stale — tell it to stand down instead of
      // leaving a half-dead tab that misses directs and acts on ghosts.
      // (M2: one map entry, latest wins, loser told explicitly.)
      const prevSid = this.userSocketMap.get(effectiveId);
      if (prevSid && prevSid !== client.id) {
        this.server.sockets.sockets.get(prevSid)?.emit('session:superseded');
      }
      this.userSocketMap.set(effectiveId, client.id);
      // Presence only for a real identity — never for an opaque handle.
      if (verified) this.setPresence(effectiveId, { isOnline: true });
      // Cache the live rating for lobby display: enrichRoom falls back to
      // this when the member has no live socket, instead of a fictional
      // 1500 that conflates strangers with newcomers.
      if (verified) this.userRatingCache.set(effectiveId, rating);
      // Fresh socket for someone already searching: refresh their queue
      // line so the sweep never matches a dead connection.
      this.matchmakingService.updateSocket(effectiveId, client.id);
      // Reconnect-sign-in (M11): the client upgraded identities (guest →
      // account) across a reconnect and tells us the previous id via the
      // handshake. Same guarded migration as in-place adopt — seats, grace,
      // rooms, challenges follow the verified identity instead of orphaning
      // the old seat. Refusals (previous session still live) keep the new
      // identity as-is: the caller surfaces NOT_SEATED and searches again.
      if (verified) {
        const previousUserId = client.handshake.query?.previousUserId as string | undefined;
        if (previousUserId && previousUserId !== effectiveId) {
          const migrated = this.migrateIdentity(previousUserId, effectiveId, displayName, client, rating);
          if (!migrated.success) {
            this.logger.warn(`Reconnect migration refused ${previousUserId} -> ${effectiveId}: ${migrated.error}`);
          }
        }
      }

      this.logger.log(`Socket connected: ${client.id} (User: ${effectiveId}, Rating: ${rating})`);
    } catch (err: any) {
      this.logger.error(`Error in handleConnection: ${err.message}`);
    }
  }

  /**
   * Identity adoption WITHOUT reconnect: the caller proves the new id by
   * presenting a verifiable credential for it (Google JWT), and the old id
   * is taken from THIS socket's own verified identity — never from a
   * client-supplied field. Naming somebody else's id is therefore useless:
   * you can only ever migrate yourself.
   */
  /**
   * Single identity-migration path for guest→account upgrades, used by
   * in-place adopt AND reconnect-sign-in alike (M11). Moves queue, game
   * seats (including mid-grace state, via the service), rooms, challenges,
   * and the game mapping — then fixes routing + presence for both ids.
   *
   * Safety: a seat is only ever taken from an identity whose socket is gone
   * (or is this same socket). A client asserting someone else's live id gets
   * a refusal, never their game.
   */
  private migrateIdentity(
    prevId: string,
    newId: string,
    newName: string,
    client: Socket,
    priorRating: number
  ): { success: true } | { success: false; error: string } {
    if (!prevId || !newId || prevId === newId) return { success: true };
    const prevSocketId = this.userSocketMap.get(prevId);
    const prevSocket =
      prevSocketId ? this.server.sockets.sockets.get(prevSocketId) : undefined;
    if (prevSocket && prevSocket.id !== client.id) {
      return { success: false, error: 'Previous session is still active.' };
    }
    // Drop stale routing to the old id (M10): same-socket adopt, or a dead
    // previous socket that must never address a ghost connection again.
    const touchedRooms = this.roomService.migrateUser(prevId, newId, newName);
    for (const room of touchedRooms) {
      client.join(room.id);
      this.server.to(room.id).emit('room:state', this.enrichRoom(room));
    }
    this.gameService.migrateUser(prevId, newId);
    this.matchmakingService.migrateUser(prevId, newId);
    this.challengeService.migrateUser(prevId, newId);
    if (this.activeGameUserMap.get(prevId)) {
      this.activeGameUserMap.set(newId, this.activeGameUserMap.get(prevId)!);
      this.activeGameUserMap.delete(prevId);
    }
    // Drop stale routing to the old id (M10): same-socket adopt, or a dead
    // previous socket that must never address a ghost connection again.
    if (!prevSocket || prevSocketId === client.id) {
      this.userSocketMap.delete(prevId);
    }
    this.socketUserMap.set(client.id, {
      userId: newId,
      displayName: newName,
      rating: priorRating,
      verified: true,
    });
    this.userSocketMap.set(newId, client.id);
    this.setPresence(prevId, { isOnline: false });
    this.setPresence(newId, { isOnline: true });
    this.logger.log(`Adopted live state ${prevId} -> ${newId}`);
    return { success: true };
  }

  @SubscribeMessage('session:adopt')
  async handleSessionAdopt(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { newToken: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      return { success: false, error: 'Not authenticated. Reconnect and try again.' };
    }
    let newId: string;
    let newName = user.displayName;
    try {
      const claims = await this.authService.verifyToken(payload.newToken);
      const adopted = await this.authService.getOrCreateUser(claims);
      newId = adopted.id;
      newName = adopted.displayName;
    } catch {
      return { success: false, error: 'New credential did not verify.' };
    }
    if (!newId || newId === user.userId) {
      return { success: true, userId: user.userId };
    }

    const migrated = this.migrateIdentity(user.userId, newId, newName, client, user.rating);
    if (!migrated.success) return { success: false, error: migrated.error };
    return { success: true, userId: newId };
  }

  /**
   * Identity re-sync WITHOUT reconnect: the client tells us something
   * about its identity changed (guest minted, name chosen/edited,
   * sign-in/out). We trust nothing in the payload — there isn't one —
   * and re-read the display name from the verified profile, then refresh
   * every snapshot that embeds it (gateway map, room slots, queue entry).
   * This is what keeps rooms and matches showing the chosen name instead
   * of the stale handshake name from app start.
   */
  @SubscribeMessage('session:sync')
  async handleSessionSync(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user.verified || !this.prisma.isConnected) return;
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId: user.userId },
      });
      if (!profile) return;
      // Same canonical field as handleConnection: username, not displayName.
      const name = profile.username || profile.displayName;
      const mapped = this.socketUserMap.get(client.id);
      if (mapped && mapped.displayName !== name) {
        this.socketUserMap.set(client.id, { ...mapped, displayName: name });
        // A rename must reach the game in progress, not just the next one. The
        // game state holds its own copy of player names and had no way to be
        // updated, so a rename mid-game stayed invisible until the rematch.
        this.gameService.setPlayerName(user.userId, name);
        this.server.to(user.userId).emit('game:playerRenamed', {
          userId: user.userId,
          displayName: name,
        });      }
      this.matchmakingService.updateDisplayName(user.userId, name);
      const roomIds = this.roomService.refreshDisplayName(user.userId, name);
      for (const roomId of roomIds) {
        const room = this.roomService.getRoom(roomId);
        if (room) this.server.to(roomId).emit('room:state', this.enrichRoom(room));
      }
    } catch (err: any) {
      this.logger.warn(`session:sync failed for ${user.userId}: ${err?.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userInfo = this.socketUserMap.get(client.id);
    if (!userInfo) return;

    const { userId } = userInfo;
    // A newer socket already speaks for this user (reconnect / second
    // device): THIS socket is the stale one and its teardown must not touch
    // the live session. Without this a normal reconnect forfeited the
    // player's own game a moment after they returned — the old socket's
    // disconnect armed a grace timer against the seat they had just
    // reclaimed. Same guard as the connect path, which refuses to overwrite
    // identity for a socket that went away mid-handshake.
    const live = this.userSocketMap.get(userId);
    if (live && live !== client.id) {
      this.logger.log(
        `Socket disconnected (stale, superseded by ${live}): ${client.id} (User: ${userId})`
      );
      this.socketUserMap.delete(client.id);
      return;
    }

    this.matchmakingService.removeFromQueue(userId);
    this.setPresence(userId, { isOnline: false, isPlaying: false });

    // Free WAITING lobby seats (host hands over, empty rooms disband with
    // their invites): without this a blipped lobby seat — crown included —
    // stayed occupied forever. IN_GAME rooms are untouched: grace covers a
    // mid-match absence and the room is still theirs on return.
    for (const left of this.roomService.leaveAllWaitingRooms(userId)) {
      if (!left.disbanded && left.room) {
        this.server.to(left.roomId).emit('room:state', this.enrichRoom(left.room));
      }
    }

    // Check if user is in an active game
    const gameId = this.activeGameUserMap.get(userId);
    if (gameId) {
      const res = this.gameService.handleDisconnect(gameId, userId, (ended, finished, lastMove) => {
        this.emitMidGameForfeit(gameId, ended, finished, lastMove);
      });

      if (res) {
        // Opponents only. The leaver's own replacement socket is in this
        // room after a reconnect and must never be told "your opponent
        // left" about itself; every other seat needs `playerId` to tell
        // WHICH opponent dropped in a 3P/4P table.
        const others = this.otherSeatSockets(gameId, userId);
        if (others.length > 0) {
          this.server.to(others).emit('game:opponentDisconnected', {
            userId,
            playerId: res.playerId,
            gracePeriodSeconds: res.gracePeriodSeconds,
            // Server's own deadline: the client counts down to this instead
            // of decrementing a local copy, so a backgrounded or throttled
            // phone can never display a grace window the server would not
            // honour.
            graceEndsAt: res.graceEndsAt,
          });
        }
      }
    }

    this.socketUserMap.delete(client.id);
    // Only retract the user→socket mapping if it still points at THIS
    // socket. Deleting unconditionally would strand a newer connection.
    if (this.userSocketMap.get(userId) === client.id) {
      this.userSocketMap.delete(userId);
    }
    this.logger.log(`Socket disconnected: ${client.id} (User: ${userId})`);
  }

  /**
   * Sockets sitting in `gameId`'s room that are NOT this user.
   *
   * Room fan-out (`server.to(gameId)`) is wrong for opponent events: after a
   * reconnect the leaver's new socket is in the same room, and in multiplayer
   * every seat is somebody's opponent. Filtering by the verified
   * userId — never by a client-supplied field — is what makes the event mean
   * what it says.
   */
  private otherSeatSockets(gameId: string, userId: string): string[] {
    const room = this.server.sockets.adapter.rooms.get(gameId);
    if (!room) return [];
    const out: string[] = [];
    for (const socketId of room) {
      if (this.socketUserMap.get(socketId)?.userId === userId) continue;
      out.push(socketId);
    }
    return out;
  }

  // -------------------------------------------------------------
  // ROOM HANDLERS
  // -------------------------------------------------------------

  @SubscribeMessage('room:create')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const room = this.roomService.createRoom(
      user.userId,
      user.displayName,
      payload.mode,
      payload.timeControlMinutes,
      payload.incrementSeconds ?? 0,
      payload.wallsEach ?? 10
    );
    client.join(room.id);
    return { success: true, room: this.enrichRoom(room) };
  }

  @SubscribeMessage('room:join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { code: string }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.roomService.joinRoom(payload.code, user.userId, user.displayName);

    if (result.success) {
      client.join(result.room.id);
      this.server.to(result.room.id).emit('room:state', this.enrichRoom(result.room));
    }

    return result.success
      ? { success: true, room: this.enrichRoom(result.room) }
      : result;
  }

  @SubscribeMessage('room:invite')
  handleRoomInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; toUserId: string }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.roomService.createInvite(payload.roomId, user.userId, payload.toUserId);
    if (!result.success) return result;
    const targetSocketId = this.userSocketMap.get(payload.toUserId);
    const targetSocket = targetSocketId ? this.server.sockets.sockets.get(targetSocketId) : null;
    if (!targetSocket) return { success: false, error: 'That friend is offline.' };
    targetSocket.emit('room:inviteReceived', {
      ...result.invite,
      fromDisplayName: user.displayName,
    });
    return { success: true };
  }

  @SubscribeMessage('room:inviteRespond')
  handleRoomInviteRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { inviteId: string; accept: boolean }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.roomService.respondInvite(
      payload.inviteId,
      user.userId,
      user.displayName,
      payload.accept
    );
    if (!result.success) return result;
    if (result.room) {
      client.join(result.room.id);
      this.server.to(result.room.id).emit('room:state', this.enrichRoom(result.room));
    } else {
      const fromSocketId = this.userSocketMap.get(result.invite.fromUserId);
      if (fromSocketId) {
        this.server.to(fromSocketId).emit('room:inviteDeclined', {
          inviteId: result.invite.inviteId,
          byUserId: user.userId,
        });
      }
    }
    return { success: true, room: result.room ? this.enrichRoom(result.room) : undefined };
  }

  @SubscribeMessage('room:ready')
  handleRoomReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; isReady: boolean }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const room = this.roomService.setReady(payload.roomId, user.userId, payload.isReady);
    if (room) {
      this.server.to(room.id).emit('room:state', this.enrichRoom(room));
    }
  }

  @SubscribeMessage('room:configure')
  handleRoomConfigure(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      roomId: string;
      mode?: GameMode;
      timeControlMinutes?: number;
      incrementSeconds?: number;
      wallsEach?: number;
    }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.roomService.configureRoom(payload.roomId, user.userId, {
      mode: payload.mode,
      timeControlMinutes: payload.timeControlMinutes,
      incrementSeconds: payload.incrementSeconds,
      wallsEach: payload.wallsEach,
    });
    if (!result.success) return result;
    // Every member's lobby re-renders from this broadcast, so the table sees
    // the new setup (and the disarmed ready flags) immediately.
    this.server.to(result.room.id).emit('room:state', this.enrichRoom(result.room));
    return result;
  }

  @SubscribeMessage('room:leave')
  handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return { success: false, error: 'Not authenticated. Reconnect and try again.' };
    client.leave(payload.roomId);
    const { room } = this.roomService.leaveRoom(payload.roomId, user.userId);
    if (room) {
      this.server.to(room.id).emit('room:state', this.enrichRoom(room));
    }
    return { success: true };
  }

  @SubscribeMessage('room:kick')
  handleRoomKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; userId: string }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.roomService.kickPlayer(payload.roomId, user.userId, payload.userId);
    if (!result.success || !result.room) {
      return result;
    }
    // Detach the kicked socket so it stops receiving room updates, and
    // tell it explicitly so its lobby closes immediately.
    const kickedSocketId = this.userSocketMap.get(payload.userId);
    if (kickedSocketId) {
      const kickedSocket = this.server.sockets.sockets.get(kickedSocketId);
      kickedSocket?.leave(payload.roomId);
      kickedSocket?.emit('room:kicked', { roomId: payload.roomId });
    }
    this.server.to(result.room.id).emit('room:state', this.enrichRoom(result.room));
    return { success: true };
  }

  /**
   * True when this user is still actually playing a match (as opposed to
   * spectating a finished seat, or having no game at all). Used to stop a
   * player who is mid-match from counting towards a room's ready quorum.
   */
  private isUserInLiveGame(userId: string): boolean {
    const gameId = this.activeGameUserMap.get(userId);
    if (!gameId) return false;
    const game = this.gameService.getGame(gameId);
    if (!game || game.state.status !== 'IN_PROGRESS') return false;
    // A FINISHED seat is watching, not playing: it must not block the host,
    // or a finished multiplayer player could never leave the board.
    // Seats are keyed by playerId (`p1`, `p2`, …), never by userId — resolve
    // through userPlayerIds first, or the lookup misses and every seated
    // player (even finished) counts as busy.
    const seatId = game.userPlayerIds[userId];
    const seat = seatId ? game.state.players.find((p) => p.id === seatId) : undefined;
    return !seat || seat.status === 'ACTIVE';
  }

  @SubscribeMessage('room:start')
  async handleRoomStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }

    // A seat can only be readied from the lobby. If someone is still mid-match
    // they are not in the lobby, so they must not count towards the quorum —
    // otherwise the host starts a game that one player never joined.
    // Liveness + busy (self included) is enforced inside createGameChecked;
    // the room only needs its own start preconditions before that.

    const result = this.roomService.startRoom(payload.roomId, user.userId);
    if (!result.success) {
      client.emit('game:error', { code: 'START_FAILED', message: result.error });
      return;
    }

    const gameId = `game-room-${Date.now()}`;
    // Random seat order every match. Seats map to colors and to first move in
    // order, so without this the host is always blue and always starts. The
    // host crown is untouched — only table positions shuffle.
    const shuffledIds = shuffleSeats(result.players.map((p) => p.userId));

    // ALL online human games are rated (server-decided — no client flag).
    const created = await this.createGameChecked({
      gameId,
      mode: result.room.mode,
      seatUserIds: shuffledIds,
      timeControlMinutes: result.room.timeControlMinutes,
      incrementSeconds: result.room.incrementSeconds,
      wallsEach: result.room.wallsEach,
      isRanked: true,
    });
    if (!created.success) {
      client.emit('game:error', { code: 'START_FAILED', message: created.error });
      return;
    }

    // Remember the room so it can be returned to its lobby when this game
    // finishes (see returnRoomToLobby).
    this.gameRoomMap.set(gameId, payload.roomId);

    // Tell the room the game is running and that nobody is ready any more, so
    // no client keeps showing a stale "ready" lobby.
    this.server.to(payload.roomId).emit('room:state', this.enrichRoom(result.room));
    this.server.to(payload.roomId).emit('room:started', { roomId: payload.roomId, gameId });
  }

  /**
   * Re-syncs a member's lobby view from server truth. The client keeps a
   * snapshot of the room from before a match started, and returning to the
   * lobby from a finished match must not trust that stale copy.
   *
   * This is also where the room changes hands: a player arriving at the lobby
   * is proof they are back, so a room whose game is over is reset to WAITING
   * here and the readiness that outlived the match is dropped.
   */
  @SubscribeMessage('room:sync')
  handleRoomSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId?: string; code?: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return { success: false, error: 'Not authenticated.' };

    const found = payload.roomId
      ? this.roomService.getRoom(payload.roomId)
      : payload.code
      ? this.roomService.getRoomByCode(payload.code)
      : undefined;

    if (!found) return { success: false, error: 'Room not found.' };
    // Membership is required: this must never be a way to watch a lobby you
    // are not seated in.
    if (!found.slots.some((s) => s.userId === user.userId)) {
      return { success: false, error: 'You are not in this room.' };
    }

    const gameId = [...this.gameRoomMap.entries()].find(([, roomId]) => roomId === found.id)?.[0];
    let room = found;
    if (gameId) {
      const game = this.gameService.getGame(gameId);
      if (!game || game.state.status === 'COMPLETED') {
        this.returnRoomToLobby(gameId);
        room = this.roomService.getRoom(found.id) ?? found;
      }
    }

    client.join(room.id);
    client.emit('room:state', this.enrichRoom(room));
    return { success: true };
  }

  // -------------------------------------------------------------
  // MATCHMAKING HANDLERS
  // -------------------------------------------------------------

  @SubscribeMessage('matchmaking:find')
  handleFindMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const busyGameId = this.activeGameUserMap.get(user.userId);
    const busyGame = busyGameId ? this.gameService.getGame(busyGameId) : undefined;
    if (busyGame && busyGame.state.status === 'IN_PROGRESS') {
      client.emit('game:error', { code: 'ALREADY_IN_GAME', message: 'Finish your current game first.' });
      return { success: false };
    }
    if (busyGameId) this.activeGameUserMap.delete(user.userId);
    this.matchmakingService.addToQueue({
      userId: user.userId,
      displayName: user.displayName,
      rating: user.rating,
      mode: payload.mode,
      timeControlMinutes: payload.timeControlMinutes,
      incrementSeconds: payload.incrementSeconds ?? 0,
      wallsEach: payload.wallsEach ?? 10,
      joinedAt: Date.now(),
      socketId: client.id,
    });

    this.runMatchmakingSweep();
  }

  @SubscribeMessage('matchmaking:cancel')
  handleCancelMatchmaking(@ConnectedSocket() client: Socket) {
    const user = this.getUser(client);
    if (!user.verified) return;
    this.matchmakingService.removeFromQueue(user.userId);
    return { success: true };
  }

  // -------------------------------------------------------------
  // FRIEND CHALLENGE HANDLERS (1v1, ranked)
  // -------------------------------------------------------------

  @SubscribeMessage('challenge:send')
  async handleChallengeSend(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { toUserId: string; mode: GameMode; timeControlMinutes: number; incrementSeconds?: number; wallsEach?: number }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    if (payload.toUserId === user.userId) {
      return { success: false, error: 'You cannot challenge yourself.' };
    }
    // Fail CLOSED while the database is unreachable: block enforcement
    // cannot be checked, and a challenge must not go through unchecked.
    // (Matchmaking stays fail-open by design — availability over strictness
    // for open queueing; challenges are directed and stay strict.)
    if (!this.prisma.isConnected) {
      return { success: false, error: 'Could not verify blocks. Try again.' };
    }
    // Blocks run both directions and cover challenges: a blocked player can
    // neither send nor receive. Neutral copy — it must not reveal who
    // blocked whom.
    if (await this.isBlockedBetween(user.userId, payload.toUserId)) {
      return { success: false, error: 'You cannot challenge this player.' };
    }
    const targetSocketId = this.userSocketMap.get(payload.toUserId);
    const targetSocket = targetSocketId
      ? this.server.sockets.sockets.get(targetSocketId)
      : undefined;
    if (!targetSocket) {
      return { success: false, error: 'Friend is offline.' };
    }
    // Busy means seated in a LIVE game — stale map entries (finished
    // games, silent leavers) are cleared instead of blocking forever.
    const busyGameId = this.activeGameUserMap.get(payload.toUserId);
    const busyGame = busyGameId ? this.gameService.getGame(busyGameId) : undefined;
    if (busyGame && busyGame.state.status === 'IN_PROGRESS') {
      return { success: false, error: 'Friend is already in a game.' };
    }
    if (busyGameId) this.activeGameUserMap.delete(payload.toUserId);

    const { challenge, replaced } = this.challengeService.createChallenge(
      user.userId,
      user.displayName,
      payload.toUserId,
      payload.mode,
      payload.timeControlMinutes,
      payload.incrementSeconds ?? 0,
      payload.wallsEach ?? 10,
      (expired) => {
        // Fresh socket lookups — the captured socket may be long dead
        // (reconnects), which used to leave the toast stuck forever.
        for (const uId of [expired.fromUserId, expired.toUserId]) {
          const sid = this.userSocketMap.get(uId);
          sid &&
            this.server.sockets.sockets
              .get(sid)
              ?.emit('challenge:expired', { challengeId: expired.id });
        }
      }
    );
    if (replaced) {
      const sid = this.userSocketMap.get(replaced.fromUserId);
      sid &&
        this.server.sockets.sockets
          .get(sid)
          ?.emit('challenge:cancelled', { challengeId: replaced.id });
    }
    targetSocket.emit('challenge:received', challenge);
    return { success: true, challenge };
  }

  @SubscribeMessage('challenge:respond')
  async handleChallengeRespond(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { challengeId: string; accept: boolean }
  ) {
    const user = this.getUser(client);
    const denied = this.requireVerified(user);
    if (denied) return denied;
    const result = this.challengeService.resolve(payload.challengeId, user.userId, payload.accept);
    if (!result.success || !payload.accept) {
      if (result.success) {
        const senderId = this.userSocketMap.get(result.challenge.fromUserId);
        senderId &&
          this.server.sockets.sockets
            .get(senderId)
            ?.emit('challenge:declined', { challengeId: payload.challengeId, byUserId: user.userId });
      }
      return result;
    }

    const challenge = result.challenge;
    // Blocked after sending (or a stale acceptance racing one): the game
    // must not be created. Dies like a decline so the sender's toast clears
    // instead of hanging on a match that never comes. Fail closed while the
    // database is unreachable, like challenge:send.
    if (!this.prisma.isConnected) {
      return { success: false, error: 'Could not verify blocks. Try again.' };
    }
    if (await this.isBlockedBetween(challenge.fromUserId, challenge.toUserId)) {
      const senderId = this.userSocketMap.get(challenge.fromUserId);
      senderId &&
        this.server.sockets.sockets
          .get(senderId)
          ?.emit('challenge:declined', { challengeId: payload.challengeId, byUserId: user.userId });
      return { success: false, error: 'Challenge is no longer available.' };
    }
    const gameId = `game-challenge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Coin flip seats — challenger does not always move first.
    const flipped = Math.random() < 0.5;
    const seatIds = flipped
      ? [challenge.toUserId, challenge.fromUserId]
      : [challenge.fromUserId, challenge.toUserId];

    // Both sides re-checked live here: an accept for an offline sender (or a
    // seat already in another game) dies like a decline instead of creating
    // a ghost game nobody can join (C2). Names/ratings are re-read live
    // inside — never the frozen send-time snapshot (M17).
    const created = await this.createGameChecked({
      gameId,
      mode: challenge.mode,
      seatUserIds: seatIds,
      timeControlMinutes: challenge.timeControlMinutes,
      incrementSeconds: challenge.incrementSeconds,
      wallsEach: challenge.wallsEach,
      isRanked: true,
    });
    if (!created.success) {
      const senderId = this.userSocketMap.get(challenge.fromUserId);
      senderId &&
        this.server.sockets.sockets
          .get(senderId)
          ?.emit('challenge:declined', { challengeId: payload.challengeId, byUserId: user.userId });
      client.emit('game:error', { code: 'CHALLENGE_FAILED', message: created.error });
      return { success: false, error: created.error };
    }

    const firstSocket = this.server.sockets.sockets.get(this.userSocketMap.get(seatIds[0]) ?? '');
    const secondSocket = this.server.sockets.sockets.get(this.userSocketMap.get(seatIds[1]) ?? '');

    const accepted = {
      challengeId: challenge.id,
      gameId,
      mode: challenge.mode,
      timeControlMinutes: challenge.timeControlMinutes,
      incrementSeconds: challenge.incrementSeconds,
    };
    firstSocket?.emit('challenge:accepted', accepted);
    secondSocket?.emit('challenge:accepted', accepted);
    return { success: true };
  }

  @SubscribeMessage('challenge:cancel')
  handleChallengeCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { challengeId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return;
    const challenge = this.challengeService.getChallenge(payload.challengeId);
    if (!challenge || challenge.fromUserId !== user.userId) return;
    this.challengeService.clear(payload.challengeId);
    const targetId = this.userSocketMap.get(challenge.toUserId);
    targetId &&
      this.server.sockets.sockets.get(targetId)?.emit('challenge:cancelled', { challengeId: payload.challengeId });
  }

  /**
   * Whether either user blocked the other. Fail-open while the database is
   * unreachable: a blip must not break every challenge and match in flight
   * — enforcement resumes with the connection.
   */
  private async isBlockedBetween(aUserId: string, bUserId: string): Promise<boolean> {
    if (!this.prisma.isConnected) return false;
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: aUserId, blockedId: bUserId },
          { blockerId: bUserId, blockedId: aUserId },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  /**
   * Put a swept player back in line with FRESH routing data. findMatches
   * hands out snapshots; by requeue time the socket/name may have moved on
   * (reconnect, rename) and re-pushing the stale copy would seat the next
   * sweep against a dead line or a wrong name (M9). Offline players are not
   * requeued at all. Wait time (joinedAt) is preserved — requeue never
   * resets it, only a fresh search does.
   */
  private requeuePlayer(player: MatchmakingRequest): void {
    const sid = this.userSocketMap.get(player.userId);
    const live = sid ? this.server.sockets.sockets.get(sid) : undefined;
    if (!live || !sid) return;
    const info = this.socketUserMap.get(sid);
    this.matchmakingService.requeue({
      ...player,
      socketId: sid,
      displayName: info?.displayName ?? player.displayName,
      rating: info?.rating ?? player.rating,
    });
  }

  private async runMatchmakingSweep() {
    // Dead entries never reach findMatches: purge them first so a drifted
    // queue (missed socket update, async gap) cannot seat a ghost table.
    const purged = this.matchmakingService.purgeDisconnected((sid) =>
      this.server.sockets.sockets.has(sid)
    );
    if (purged.length > 0) {
      this.logger.log(`Matchmaking purged ${purged.length} dead queue entries.`);
    }
    const matches = this.matchmakingService.findMatches();
    for (const match of matches) {
      const players = match.players;
      // Blocks are pair-wise: no seat in a matched table may have blocked
      // (or be blocked by) another. Offenders go back in the queue rather
      // than being dropped, so they keep searching past each other instead
      // of matching here on the next sweep.
      let blockedPair = false;
      for (let a = 0; a < players.length && !blockedPair; a++) {
        for (let b = a + 1; b < players.length && !blockedPair; b++) {
          if (await this.isBlockedBetween(players[a].userId, players[b].userId)) {
            blockedPair = true;
          }
        }
      }
      if (blockedPair) {
        for (const player of players) this.requeuePlayer(player);
        continue;
      }
      const gameId = `game-ranked-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Coin flip seats: waiting longest must not mean always-blue-first.
      const flipped = Math.random() < 0.5;
      const orderedPlayers = flipped ? [...players].reverse() : players;

      // Liveness is enforced inside createGameChecked, against the LIVE
      // socket map — not the pre-sweep snapshot. On failure the live seats go
      // back in the queue and keep searching (never silently dropped, C1);
      // the sweep re-runs every 2s, so this is a delay, not a dead end.
      // NOTE: re-queue re-pushes the snapshot (joinedAt not preserved) —
      // fairness pass (F3) fixes preservation.
      const created = await this.createGameChecked({
        gameId,
        mode: match.mode,
        seatUserIds: orderedPlayers.map((p) => p.userId),
        timeControlMinutes: match.timeControlMinutes,
        incrementSeconds: match.incrementSeconds,
        wallsEach: match.wallsEach,
        isRanked: true,
      });
      if (!created.success) {
        // Live seats keep searching with fresh routing + preserved wait
        // (requeuePlayer); the sweep re-runs every 2s, so this is a delay,
        // not a dead end — no failure toast on transient churn.
        this.logger.warn(`Matchmaking creation failed for ${gameId}: ${created.error}`);
        for (const player of players) this.requeuePlayer(player);
        continue;
      }
      // Personalized payload: everyone sees WHO they matched, not just
      // a game id. The finding screen shows the opponent card straight
      // from this instead of a blank connecting page. Emitted to the live
      // socket (not the pre-sweep snapshot) so a reconnected seat still
      // hears its match.
      const seats = created.users.map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        rating: u.rating.rating ?? 1500,
      }));
      for (const player of players) {
        const liveSid = this.userSocketMap.get(player.userId);
        if (!liveSid) continue;
        this.server
          .to(liveSid)
          .emit('matchmaking:matched', {
            gameId,
            mode: match.mode,
            opponents: seats.filter((s) => s.userId !== player.userId),
          });
      }
    }
  }

  // -------------------------------------------------------------
  // GAMEPLAY HANDLERS
  // -------------------------------------------------------------

  /**
   * Walking away from a live game (back button, accepting another game).
   * Active players forfeit via the resign path; finished players leave
   * with their placement intact (seat freed, game continues).
   * Completed games no-op.
   */
  @SubscribeMessage('game:leave')
  async handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return;
    client.leave(payload.gameId);
    const game = this.gameService.getGame(payload.gameId);
    if (!game || game.state.status !== 'IN_PROGRESS') return;
    if (!game.userPlayerIds[user.userId]) return;
    const result = await this.gameService.leaveGame(payload.gameId, user.userId);
    if (!result.left) return;
    if (!result.forfeited) {
      // Finished player walked away: free the seat, keep the placement.
      this.setPresence(user.userId, { isPlaying: false });
      this.activeGameUserMap.delete(user.userId);
      return;
    }
    if (result.recorded) {
      this.server.to(payload.gameId).emit('game:actionAccepted', result.recorded);
    }
    if (result.finished) {
      this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...result.finished });
    }
    if (result.ended) {
      await this.endGame(payload.gameId, result.ended);
    }
  }

  @SubscribeMessage('game:join')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      gameId: string;
      lastSequence?: number;
      pendingActions?: { clientActionId: string; action: GameAction }[];
    }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      this.logger.warn(
        `game:join rejected (unverified) socket=${client.id} userId=${user.userId} game=${payload.gameId}`
      );
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    // No spectating: only seated players may join a game's channel. The seat
    // is looked up with THIS socket's server-verified id — never anything the
    // client asserted — so a client whose local identity drifted simply is not
    // seated, and is told so precisely instead of being left to guess.
    const existing = this.gameService.getGame(payload.gameId);
    const seat = existing?.userPlayerIds[user.userId];
    if (!existing || !seat) {
      this.logger.warn(
        `game:join rejected (not seated) socket=${client.id} userId=${user.userId} game=${payload.gameId} ` +
          `known=${existing ? Object.keys(existing.userPlayerIds).join(',') : 'game-not-found'}`
      );
      client.emit('game:error', {
        code: 'NOT_SEATED',
        message: 'This match was created for a different account. Go back and find a new opponent.',
      });
      return;
    }
    client.join(payload.gameId);
    // Point at live games only: a drop mid-pump still arms grace through
    // this mapping, but joining a finished table must not resurrect a
    // mapping that completion already cleared (M13).
    if (this.gameService.getGame(payload.gameId)?.state.status === 'IN_PROGRESS') {
      this.activeGameUserMap.set(user.userId, payload.gameId);
    }

    // Kill the grace timer NOW, synchronously. The loop below awaits a DB
    // round-trip per unconfirmed move; if the grace window expires inside it,
    // the server forfeits a seat whose owner is standing right here. The
    // sync is still taken after the replay, so the client still gets
    // post-replay truth — the timer and the sync are deliberately separate.
    this.gameService.cancelDisconnectGrace(payload.gameId, user.userId);
    // Count this seat toward the join quorum: when every seat has joined,
    // the clock starts from now with full time (never billed for pairing +
    // join latency). Idempotent — rejoins are no-ops.
    this.gameService.markSeatJoined(payload.gameId, user.userId);

    // Collapse overlapping joins into one replay + sync. Reconnect storms,
    // retry loops and queue flushes all emit `game:join` within
    // milliseconds, and each used to spawn its own DB replay, its own sync
    // and its own opponent fan-out. The latest payload wins; a pump already
    // running picks it up when it finishes the current pass.
    const joinKey = `${payload.gameId}:${user.userId}`;
    this.joinLatest.set(joinKey, {
      client,
      payload: {
        gameId: payload.gameId,
        lastSequence: payload.lastSequence,
        pendingActions: payload.pendingActions,
      },
      seat,
    });
    if (this.joinActive.has(joinKey)) return;
    this.joinActive.add(joinKey);
    void (async () => {
      try {
        let next;
        while ((next = this.joinLatest.get(joinKey))) {
          this.joinLatest.delete(joinKey);
          await this.processJoin(user.userId, next);
        }
      } finally {
        this.joinActive.delete(joinKey);
      }
    })();
  }

  /**
   * One join pass: replay the unconfirmed tail, then answer with truth.
   *
   * Reconnect reconciliation replays the client's unconfirmed tail through
   * validation (never blind). Newly applied moves broadcast so any
   * connected opponent stays exact; illegal ones die here and the final
   * sync below rolls the sender back.
   */
  private async processJoin(
    userId: string,
    join: {
      client: Socket;
      payload: {
        gameId: string;
        lastSequence?: number;
        pendingActions?: { clientActionId: string; action: GameAction }[];
      };
      seat: string;
    }
  ): Promise<void> {
    const { client, payload, seat } = join;
    // A socket that died mid-pump gets no replay and no sync: answering it
    // wastes a DB replay per pass and can announce a return that never
    // happened. The client rejoins and pumps again when it is actually back.
    if (client.disconnected) return;
    // Tails are capped client-side (19); beyond 100 this is abuse or a bug,
    // so process a bounded page and log instead of truncating silently.
    const rawTail = payload.pendingActions ?? [];
    if (rawTail.length > 100) {
      this.logger.warn(`Join tail over cap, truncating ${payload.gameId} (${rawTail.length})`);
    }
    const pendings = rawTail.slice(0, 100);
    for (const p of pendings) {
      if (!p || typeof p.clientActionId !== 'string' || !p.action) continue;
      try {
        const res = await this.gameService.resubmitAction(payload.gameId, userId, {
          clientActionId: p.clientActionId,
          action: p.action as GameAction,
        });
        if (res.success && !res.replayed) {
          this.server.to(payload.gameId).emit('game:actionAccepted', res.recorded);
          if (res.finished) {
            this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...res.finished });
          }
          if (res.ended) {
            await this.endGame(payload.gameId, res.ended);
          }
        }
      } catch {
        // ignore one bad resubmit; the sync below is the truth
      }
    }

    const sync = this.gameService.handleReconnect(payload.gameId, userId);
    if (sync) {
      if (client.disconnected) return;
      // Opponents only — this socket just joined the room, so room
      // fan-out would have the returnee announce their own return.
      const others = this.otherSeatSockets(payload.gameId, userId);
      if (others.length > 0) {
        this.server.to(others).emit('game:opponentReconnected', {
          userId,
          playerId: seat,
        });
      }
      client.emit('game:sync', sync);
    } else {
      const existingSync = this.gameService.getSyncState(
        payload.gameId,
        payload.lastSequence ?? 0,
        userId
      );
      if (existingSync) {
        if (client.disconnected) return;
        client.emit('game:sync', existingSync);
      } else {
        client.emit('game:error', {
          code: 'GAME_NOT_IN_PROGRESS',
          message: 'That match has already finished.',
        });
      }
    }
  }

  @SubscribeMessage('game:action')
  async handleGameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string; action: GameAction; clientActionId?: string; expectedSequence?: number },
    @Ack() ack?: (result: ActionAck) => void
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      ack?.({ ok: false, code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const result = await this.gameService.processAction(payload.gameId, user.userId, payload.action, {
      clientActionId: payload.clientActionId,
      expectedSequence: payload.expectedSequence,
    });

    if (result.success) {
      // The turn passed, so any inactivity notice for the previous one is
      // stale. Clearing it here (rather than when the next warning fires)
      // means a player who moved never keeps seeing a countdown they have
      // already escaped.
      this.server.to(payload.gameId).emit('game:afkCleared', { playerId: result.recorded.playerId });
      // Answer the mover FIRST. The room broadcast below can be slow (fan-out,
      // serialization, a busy event loop); the player who just moved must not
      // sit on a locked board waiting for it. The ack and the echo carry the
      // same recorded action and the client applies them idempotently.
      ack?.({ ok: true, recorded: result.recorded });
      this.server.to(payload.gameId).emit('game:actionAccepted', result.recorded);
      if (result.finished) {
        this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...result.finished });
      }
      if (result.ended) {
        // `result.recorded` was already emitted above; endGame only sends it
        // when passed explicitly, so no double-emit here.
        await this.endGame(payload.gameId, result.ended);
      }
    } else {
      ack?.({ ok: false, code: result.error.code, message: result.error.message });
      client.emit('game:error', result.error);
    }
  }

  @SubscribeMessage('game:resign')
  async handleResign(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const result = await this.gameService.resign(payload.gameId, user.userId);
    if (result.success) {
      this.server.to(payload.gameId).emit('game:actionAccepted', result.recorded);
      if (result.finished) {
        this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...result.finished });
      }
      if (!result.ended) {
        // Mid-game forfeit: the match continues for the rest.
        if (!result.finished) {
          client.emit('game:error', { code: 'RESIGN_FAILED', message: 'Resign did not complete.' });
        }
        return;
      }
      // Terminal resign: recorded + finished already emitted above; endGame
      // persists, announces the ending, and frees seats/presence/room.
      await this.endGame(payload.gameId, result.ended);
    } else {
      client.emit('game:error', { code: 'RESIGN_FAILED', message: result.error });
    }
  }

  /**
   * Ephemeral quick reactions. Validated and relayed, never stored, never
   * part of the authoritative action sequence: no game state, clock, rating
   * or history is touched. `client.to()` relays to the other seats only.
   *
   * Drops (never errors) on anything invalid — a reaction is decoration, and
   * a decoration must never produce an error toast. A 500ms per-socket
   * throttle absorbs tap floods without a rate-limiting framework.
   */
  @SubscribeMessage('game:reaction')
  handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId?: string; reaction?: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return;
    const gameId = payload?.gameId;
    const reaction = payload?.reaction;
    if (typeof gameId !== 'string' || typeof reaction !== 'string') return;
    if (!REACTION_KINDS.has(reaction)) return;
    const existing = this.gameService.getGame(gameId);
    if (!existing?.userPlayerIds[user.userId]) return;
    const now = Date.now();
    const last = this.reactionLastAt.get(user.userId) ?? 0;
    if (now - last < REACTION_THROTTLE_MS) return;
    this.reactionLastAt.set(user.userId, now);
    // Per-user throttle with a bounded map: the old socket-keyed map cleared
    // EVERYONE's throttle at 5000 entries, so one flood reset the whole
    // server's. Oldest-user eviction keeps it bounded without cross-talk.
    if (this.reactionLastAt.size > 5000) {
      const oldest = this.reactionLastAt.keys().next();
      if (!oldest.done) this.reactionLastAt.delete(oldest.value);
    }
    client.to(gameId).emit('game:reaction', { gameId, reaction, fromUserId: user.userId });
  }

  @SubscribeMessage('game:rematch')
  async handleRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const result = this.gameService.offerRematch(payload.gameId, user.userId);

    if (result.offered) {
      if (result.newGameParams) {
        // All seats accepted! Create new game and notify players
        const params = result.newGameParams;
        // Re-read every seat's live rating for the new rating period.
        // `offerRematch` can only fire once the previous game COMPLETED, but it
        // carries that game's PRE-match snapshot — seeding the rematch with it
        // recomputed every rematch from a stale base: the same delta printed
        // again (+164, +164), and the stored rating was overwritten with a
        // value derived from the old snapshot, so real points vanished.
        // Matchmaking, challenges and rooms all re-read here; rematch now
        // matches them.
        // Same guarded path as every other creation site: all four hooks
        // (a rematch that omitted AFK/forfeit desynced mid-table with zero
        // broadcast, C7), liveness re-checked (a seat that died since
        // accepting fails cleanly instead of ghosting). Ratings are re-read
        // live inside — never the pre-match snapshot (which recomputed every
        // rematch from a stale base and ate real points).
        const created = await this.createGameChecked({
          gameId: params.gameId,
          mode: params.mode,
          seatUserIds: params.users.map((u: { userId: string }) => u.userId),
          timeControlMinutes: params.timeControlMinutes,
          incrementSeconds: params.incrementSeconds,
          wallsEach: (params as { wallsEach?: number }).wallsEach,
          isRanked: params.isRanked ?? true,
        });
        if (!created.success) {
          client.emit('game:error', { code: 'REMATCH_FAILED', message: created.error });
          return { success: false, error: created.error };
        }

        this.server.to(payload.gameId).emit('matchmaking:matched', { gameId: params.gameId });
      } else {
        // Broadcast rematch offer to opponent in game room
        client.to(payload.gameId).emit('game:rematchOffered', {
          gameId: payload.gameId,
          fromUserId: user.userId,
        });
      }
    }
  }

  @SubscribeMessage('game:rematchDecline')
  handleRematchDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string }
  ) {
    const user = this.getUser(client);
    if (!user.verified) return;
    if (!this.gameService.declineRematch(payload.gameId, user.userId)) return;
    // Tell the waiting seats now instead of letting them idle out the TTL.
    this.server.to(payload.gameId).emit('game:rematchDeclined', {
      gameId: payload.gameId,
      byUserId: user.userId,
    });
  }

  /**
   * Presence is the only thing the friends list reads — nothing else
   * writes it, so the gateway owns it: online on connect, offline on
   * disconnect, playing while seated in a live game.
   */
  /**
   * Presence flip for a VERIFIED identity only. Callers must gate on
   * verified first (see handleConnection): presence must never manufacture
   * identity rows, so this is update-only and logs failures instead of
   * swallowing them.
   */
  private setPresence(userId: string, patch: { isOnline?: boolean; isPlaying?: boolean }): void {
    if (!this.prisma.isConnected) return;
    this.prisma.profile
      .updateMany({ where: { userId }, data: patch })
      .catch((err) => {
        this.logger.warn(`Presence update failed for ${userId}: ${err?.message}`);
      });
  }

  /** Marks every seated player of a game as (not) playing. Ending a game
   * also frees both seats so rematch/challenge/matchmaking work again —
   * otherwise finished players look permanently "in a game". */
  private setGamePlaying(gameId: string, playing: boolean): void {
    const game = this.gameService.getGame(gameId);
    if (!game) return;
    for (const uId of Object.values(game.playerUserIds)) {
      this.setPresence(uId, { isPlaying: playing });
      if (!playing) this.activeGameUserMap.delete(uId);
    }
    if (!playing) this.returnRoomToLobby(gameId);
  }

  /**
   * When a room's game finishes, hand the room back to its lobby so the same
   * table can play again — and so readiness is re-earned rather than carried
   * over from the match that just ended. Rematches create games that are not
   * tied to a room, so they never land here and the room stays IN_GAME.
   */
  private returnRoomToLobby(gameId: string): void {
    const roomId = this.gameRoomMap.get(gameId);
    if (!roomId) return;
    this.gameRoomMap.delete(gameId);
    const room = this.roomService.returnToLobby(roomId);
    if (room) {
      this.server.to(room.id).emit('room:state', this.enrichRoom(room));
    }
  }

  /**
   * Single guarded game-creation path for all four entries (room, challenge,
   * matchmaking sweep, rematch). Each site used to hand-roll its own checks:
   * challenge:accept never checked liveness (ghost games with a dead seat and
   * no grace), rematch omitted the AFK/forfeit hooks (silent mid-table
   * desync), and none dequeued the queue (double-booking a queued player).
   *
   * Guards, in order: every seat's socket live → nobody already in a live
   * game (self included) → dequeue all seats → live names + live ratings →
   * create with all four hooks asserted in ONE place → mappings + channel
   * joins. On any failure nothing is created and the caller notifies its
   * seats like a decline, so nobody waits on a match that never comes.
   */
  private async createGameChecked(args: {
    gameId: string;
    mode: GameMode;
    /** Seat order = table order. Shuffling stays with the caller. */
    seatUserIds: string[];
    timeControlMinutes: number;
    incrementSeconds?: number;
    wallsEach?: number;
    isRanked: boolean;
  }): Promise<
    | { success: true; users: { userId: string; displayName: string; rating: { rating: number; rd: number; vol: number } }[] }
    | { success: false; error: string }
  > {
    const nameOf = (userId: string): string => {
      const sid = this.userSocketMap.get(userId);
      return (
        (sid && this.socketUserMap.get(sid)?.displayName) || 'A player'
      );
    };
    // 1. Every seat's socket still live — otherwise no ghost game.
    const liveSockets = new Map<string, Socket>();
    const offline = args.seatUserIds.filter((id) => {
      const sid = this.userSocketMap.get(id);
      const s = sid ? this.server.sockets.sockets.get(sid) : undefined;
      if (!s) return true;
      liveSockets.set(id, s);
      return false;
    });
    if (offline.length > 0) {
      return {
        success: false,
        error: `${offline.map(nameOf).join(', ')} ${offline.length > 1 ? 'are' : 'is'} no longer online.`,
      };
    }
    // 2. Nobody already in a live game — self included, so a host cannot
    // orphan their own match by starting another (M16).
    const busy = args.seatUserIds.filter((id) => this.isUserInLiveGame(id));
    if (busy.length > 0) {
      return {
        success: false,
        error: `${busy.map(nameOf).join(', ')} ${busy.length > 1 ? 'are' : 'is'} still in a match.`,
      };
    }
    // 3. A new game consumes the queue entry — otherwise the sweep matches
    // the same player twice and orphans the first game (C3).
    for (const id of args.seatUserIds) this.matchmakingService.removeFromQueue(id);
    // 4. Live names + live ratings, never frozen snapshots (M17).
    const users = await Promise.all(
      args.seatUserIds.map(async (userId) => ({
        userId,
        displayName: nameOf(userId),
        rating: await this.fullRating(userId),
      }))
    );
    // 5. All four hooks, asserted in this one place — a creation site can no
    // longer silently drop AFK/forfeit handling (C7). Plus the quorum hook:
    // seats that never join are put on standard grace, and the waiting seats
    // get the same countdown broadcast as a mid-game disconnect.
    this.gameService.createGame({
      gameId: args.gameId,
      mode: args.mode,
      users,
      timeControlMinutes: args.timeControlMinutes,
      incrementSeconds: args.incrementSeconds,
      wallsEach: args.wallsEach,
      isRanked: args.isRanked,
      onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
      onAfkWarning: (gId, payload) => this.server.to(gId).emit('game:afkWarning', payload),
      onForfeit: (gId, ended, finished, move) =>
        this.emitMidGameForfeit(gId, ended, finished, move),
      onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
      onQuorumExpired: (gId, missing) => {
        for (const m of missing) {
          const others = this.otherSeatSockets(gId, m.userId);
          if (others.length > 0) {
            this.server.to(others).emit('game:opponentDisconnected', {
              userId: m.userId,
              playerId: m.playerId,
              gracePeriodSeconds: m.gracePeriodSeconds,
              graceEndsAt: m.graceEndsAt,
            });
          }
        }
      },
    });
    this.setGamePlaying(args.gameId, true);
    for (const id of args.seatUserIds) {
      this.activeGameUserMap.set(id, args.gameId);
      liveSockets.get(id)?.join(args.gameId);
    }
    return { success: true, users };
  }

  // Identity comes straight from the handshake so it is stable from the
  // very first message — never wait on the async connection handler.
  // The handler later enriches the map (verified name, rating).
  /**
   * Full stored Glicko model for a user (the ONE universal rating).
   * Seeding games with the real rd/vol (instead of 350/0.06 every time)
   * is what keeps rating moves sane.
   */
  private async fullRating(userId: string): Promise<{ rating: number; rd: number; vol: number }> {
    try {
      if (this.prisma.isConnected) {
        const rec = await this.prisma.rating.findUnique({
          where: { userId },
        });
        if (rec) return { rating: rec.rating, rd: rec.rd, vol: rec.vol };
      }
    } catch {
      // fall through to defaults
    }
    return { rating: 1500, rd: 350, vol: 0.06 };
  }

  /**
   * Single terminal game-ending path: persist-then-emit, then release seats,
   * presence, and the room. Every ended game flows through here (action,
   * resubmit, resign, leave, timeout, forfeit) so no path can end a game
   * without freeing it — a missing `setGamePlaying(false)` used to strand
   * rooms in IN_GAME and players as permanently "playing".
   * The final move is emitted only when provided: most callers already
   * emitted their `actionAccepted` before knowing the game ended.
   */
  private async endGame(gameId: string, ended: GameEndedDto, move?: RecordedAction): Promise<void> {
    try {
      await this.gameService.persistCompleted(gameId);
    } catch (err: any) {
      this.logger.warn(`Completion persist failed ${gameId}: ${err?.message}`);
    }
    if (move) this.server.to(gameId).emit('game:actionAccepted', move);
    this.server.to(gameId).emit('game:ended', ended);
    this.setGamePlaying(gameId, false);
  }

  /**
   * Timeout path shares the durability gate: persist-then-emit, so a
   * clocked-out game can never be observed without its full history.
   */
  private emitTimeoutEnded(gId: string, ended: GameEndedDto, move: RecordedAction): void {
    void this.endGame(gId, ended, move);
  }

  /**
   * Mid-table forfeit (AFK, or a disconnect in a 3P/4P table): the player who
   * forfeited takes the worst remaining place and the match CONTINUES.
   *
   * Shared by both reasons on purpose. The disconnect path used to inline this
   * and the AFK watchdog would otherwise need its own copy — two copies of
   * "persist, then announce a finished player" is how a placement ends up
   * broadcast without being written, or written twice.
   */
  private emitMidGameForfeit(
    gameId: string,
    ended: GameEndedDto | null,
    finished?: { playerId: string; userId: string; place: number },
    lastMove?: RecordedAction
  ): void {
    if (finished && !ended) {
      // Same ordering as the terminal branch: the forfeit move lands on
      // opponents' boards before they learn the placement. Without this,
      // their board misses the TIMEOUT move until a resync.
      if (lastMove) this.server.to(gameId).emit('game:actionAccepted', lastMove);
      this.server.to(gameId).emit('game:playerFinished', { gameId, ...finished });
      return;
    }
    if (!ended) return;
    void this.endGame(gameId, ended, lastMove);
  }

  private getUser(client: Socket): SocketUserInfo {
    const qId = client.handshake.query?.userId as string | undefined;
    const qName = client.handshake.query?.displayName as string | undefined;
    const mapped = this.socketUserMap.get(client.id);
    if (mapped) return mapped;
    // Unverified fallback: usable for NOTHING that mutates — every
    // gameplay handler must pass requireVerified first.
    return {
      userId: qId ?? client.id,
      displayName: qName ?? `Player ${client.id.substring(0, 4)}`,
      rating: 1500,
      verified: false,
    };
  }

  /**
   * Round-trip probe used to keep the server's clock charging fair.
   *
   * The client times this request/ack pair and reports the measured RTT; the
   * server smooths it per seat and refunds it from that player's clock when
   * they move. Only the client knows when the reply actually landed, so the
   * measurement has to come from there — the server can time its own side of
   * the exchange but not the wire.
   *
   * The reply echoes `clientSentAt` and carries `serverTimestamp`, which is
   * all the client needs to correct its own clock anchor (see the client hook).
   * Kept cheap and idempotent: no state beyond the smoothed estimate.
   */
  @SubscribeMessage('game:ping')
  handleGamePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId?: string; clientSentAt?: number } | undefined,
    @Ack() ack?: (res: { serverTimestamp: number; clientSentAt?: number }) => void
  ) {
    const now = Date.now();
    if (payload?.gameId && typeof payload.clientSentAt === 'number') {
      const user = this.getUser(client);
      // Samples are trusted ONLY from the seat whose clock they refund (the
      // turn holder), in a live game, at most one per second. Anything wider
      // let any verified seat bank the 1200ms cap with backdated stamps,
      // farmed off-turn in games they were not even playing.
      if (user.verified) {
        const game = this.gameService.getGame(payload.gameId);
        if (game && game.state.status === 'IN_PROGRESS') {
          const holderId = game.state.players[game.state.currentPlayerIndex]?.id;
          if (holderId && game.userPlayerIds[user.userId] === holderId) {
            const throttleKey = `${payload.gameId}:${user.userId}`;
            const last = this.pingThrottle.get(throttleKey) ?? 0;
            if (now - last >= 1000) {
              this.pingThrottle.set(throttleKey, now);
              this.gameService.recordLatency(payload.gameId, user.userId, now - payload.clientSentAt);
            }
          }
        }
      }
    }
    ack?.({ serverTimestamp: now, clientSentAt: payload?.clientSentAt });
  }

  /**
   * Authorization gate for every mutation. Returns an error payload when
   * the socket never presented a verifiable credential, otherwise null.
   */
  private requireVerified(user: SocketUserInfo): { success: false; error: string } | null {
    if (user.verified) return null;
    return { success: false, error: 'Not authenticated. Reconnect and try again.' };
  }

  /**
   * Attach each occupant's live 1v1 rating to their slot so lobby
   * scoreboards can show it without an extra round-trip.
   */
  private enrichRoom(room: RoomDto): RoomDto {
    return {
      ...room,
      slots: room.slots.map((s) => {
        if (!s.userId) return s;
        const socketId = this.userSocketMap.get(s.userId);
        const info = socketId ? this.socketUserMap.get(socketId) : undefined;
        return { ...s, rating: info?.rating ?? this.userRatingCache.get(s.userId) ?? 1500 };
      }),
    };
  }
}
