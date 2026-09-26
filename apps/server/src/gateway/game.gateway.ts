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
import { Server, Socket } from 'socket.io';
import { GameAction, GameMode, RecordedAction } from '@duoorb/game-core';
import { AuthoritativeGameService } from '../game/authoritative-game.service.js';
import { MatchmakingService } from '../matchmaking/matchmaking.service.js';
import { GuestService } from '../guest/guest.service.js';
import { resolveCorsOrigins } from '../config/cors.js';
import { RoomService } from '../rooms/room.service.js';
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
  private socketUserMap = new Map<string, SocketUserInfo>(); // socketId -> SocketUserInfo
  private userSocketMap = new Map<string, string>();         // userId -> socketId
  private activeGameUserMap = new Map<string, string>();     // userId -> gameId
  /** gameId -> roomId, for games created from a private room lobby. Lets the
   * room be handed back to its lobby when that game finishes. */
  private gameRoomMap = new Map<string, string>();
  private sweepInterval?: NodeJS.Timeout;

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly guestService?: GuestService
  ) {
    this.gameService = new AuthoritativeGameService(this.prisma);
  }

  afterInit() {
    // 2-second periodic sweep for matchmaking queue
    this.sweepInterval = setInterval(() => {
      this.runMatchmakingSweep();
    }, 2000);
    this.logger.log('GameGateway initialized with 2s matchmaking sweep loop.');

    // Crash recovery: rebuild every IN_PROGRESS game from Postgres through
    // game-core replay, restart their clocks. Unreconstructable games are
    // marked ABANDONED with reasons — never invented.
    void this.gameService
      .recoverInProgressGames({
        onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
        onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
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
      this.userSocketMap.set(effectiveId, client.id);
      // Presence only for a real identity — never for an opaque handle.
      if (verified) this.setPresence(effectiveId, { isOnline: true });
      // Fresh socket for someone already searching: refresh their queue
      // line so the sweep never matches a dead connection.
      this.matchmakingService.updateSocket(effectiveId, client.id);

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

    const prevId = user.userId;
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
    this.socketUserMap.set(client.id, {
      userId: newId,
      displayName: newName,
      rating: user.rating,
      verified: true,
    });
    this.userSocketMap.set(newId, client.id);
    this.logger.log(`Adopted live state ${prevId} -> ${newId}`);
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
    this.matchmakingService.removeFromQueue(userId);
    this.setPresence(userId, { isOnline: false, isPlaying: false });

    // Check if user is in an active game
    const gameId = this.activeGameUserMap.get(userId);
    if (gameId) {
      const res = this.gameService.handleDisconnect(gameId, userId, (ended, finished, lastMove) => {
        void (async () => {
          if (lastMove) {
            this.server.to(gameId).emit('game:actionAccepted', lastMove);
          }
          if (finished && !ended) {
            // Active player forfeited mid-game: the match continues.
            this.server.to(gameId).emit('game:playerFinished', { gameId, ...finished });
            return;
          }
          if (!ended) return;
          try {
            await this.gameService.persistCompleted(gameId);
          } catch (err: any) {
            this.logger.warn(`Completion persist failed ${gameId}: ${err?.message}`);
          }
          this.server.to(gameId).emit('game:ended', ended);
          this.setGamePlaying(gameId, false);
          this.activeGameUserMap.delete(userId);
        })();
      });

      if (res) {
        this.server.to(gameId).emit('game:opponentDisconnected', {
          userId,
          gracePeriodSeconds: res.gracePeriodSeconds,
        });
      }
    }

    this.socketUserMap.delete(client.id);
    this.userSocketMap.delete(userId);
    this.logger.log(`Socket disconnected: ${client.id} (User: ${userId})`);
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
    if (!user.verified) return;
    const room = this.roomService.setReady(payload.roomId, user.userId, payload.isReady);
    if (room) {
      this.server.to(room.id).emit('room:state', this.enrichRoom(room));
    }
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
    const seat = game.state.players.find((p) => p.id === userId);
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
    const room = this.roomService.getRoom(payload.roomId);
    if (room) {
      const busy = room.slots
        .filter((s) => s.userId !== null && s.userId !== user.userId)
        .filter((s) => this.isUserInLiveGame(s.userId!))
        .map((s) => s.displayName ?? 'A player');
      if (busy.length > 0) {
        client.emit('game:error', {
          code: 'START_FAILED',
          message: `${busy.join(', ')} ${busy.length > 1 ? 'are' : 'is'} still in a match.`,
        });
        return;
      }
    }

    const result = this.roomService.startRoom(payload.roomId, user.userId);
    if (!result.success) {
      client.emit('game:error', { code: 'START_FAILED', message: result.error });
      return;
    }

    const gameId = `game-room-${Date.now()}`;
    // ALL online human games are rated (server-decided — no client flag):
    // seed every seat with its live universal rating, not defaults.
    const usersWithRatings = await Promise.all(
      result.players.map(async (p) => ({
        userId: p.userId,
        displayName: p.displayName,
        rating: await this.fullRating(p.userId),
      }))
    );

    await this.gameService.createGame({
      gameId,
      mode: result.room.mode,
      users: usersWithRatings,
      timeControlMinutes: result.room.timeControlMinutes,
      incrementSeconds: result.room.incrementSeconds,
      wallsEach: result.room.wallsEach,
      isRanked: true,
      onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
      onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
    });

    this.setGamePlaying(gameId, true);
    // Remember the room so it can be returned to its lobby when this game
    // finishes (see returnRoomToLobby).
    this.gameRoomMap.set(gameId, payload.roomId);

    for (const p of result.players) {
      this.activeGameUserMap.set(p.userId, gameId);
      const socketId = this.userSocketMap.get(p.userId);
      if (socketId) {
        const playerSocket = this.server.sockets.sockets.get(socketId);
        playerSocket?.join(gameId);
      }
    }

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
  handleChallengeSend(
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
    const gameId = `game-challenge-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Coin flip seats — challenger does not always move first.
    const flipped = Math.random() < 0.5;
    const firstId = flipped ? challenge.toUserId : challenge.fromUserId;
    const secondId = flipped ? challenge.fromUserId : challenge.toUserId;
    const [firstRating, secondRating] = await Promise.all([
      this.fullRating(firstId),
      this.fullRating(secondId),
    ]);
    const firstSocket = this.server.sockets.sockets.get(this.userSocketMap.get(firstId) ?? '');
    const secondSocket = this.server.sockets.sockets.get(this.userSocketMap.get(secondId) ?? '');
    const firstName =
      firstId === challenge.fromUserId
        ? challenge.fromDisplayName
        : this.socketUserMap.get(this.userSocketMap.get(firstId) ?? '')?.displayName ?? 'Player';
    const secondName =
      secondId === challenge.fromUserId
        ? challenge.fromDisplayName
        : this.socketUserMap.get(this.userSocketMap.get(secondId) ?? '')?.displayName ?? 'Player';

    await this.gameService.createGame({
      gameId,
      mode: challenge.mode,
      users: [
        { userId: firstId, displayName: firstName, rating: firstRating },
        { userId: secondId, displayName: secondName, rating: secondRating },
      ],
      timeControlMinutes: challenge.timeControlMinutes,
      incrementSeconds: challenge.incrementSeconds,
      wallsEach: challenge.wallsEach,
      isRanked: true,
      onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
      onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
    });

    this.setGamePlaying(gameId, true);
    this.activeGameUserMap.set(firstId, gameId);
    this.activeGameUserMap.set(secondId, gameId);
    firstSocket?.join(gameId);
    secondSocket?.join(gameId);

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

  private async runMatchmakingSweep() {
    const matches = this.matchmakingService.findMatches();
    for (const match of matches) {
      const players = match.players;
      const sockets = players.map((player) => this.server.sockets.sockets.get(player.socketId));
      // All seats must still be live — otherwise skip (no ghost games)
      // and drop the dead entries so they re-search on return.
      if (sockets.some((socket) => !socket)) {
        for (const player of players) {
          if (!this.server.sockets.sockets.get(player.socketId)) {
            this.matchmakingService.removeFromQueue(player.userId);
          }
        }
        continue;
      }
      const gameId = `game-ranked-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Coin flip seats: waiting longest must not mean always-blue-first.
      const flipped = Math.random() < 0.5;
      const orderedPlayers = flipped ? [...players].reverse() : players;
      const ratings = await Promise.all(
        orderedPlayers.map((player) => this.fullRating(player.userId))
      );

      await this.gameService.createGame({
        gameId,
        mode: match.mode,
        users: orderedPlayers.map((player, index) => ({
          userId: player.userId,
          displayName: player.displayName,
          rating: ratings[index],
        })),
        timeControlMinutes: match.timeControlMinutes,
        incrementSeconds: match.incrementSeconds,
        wallsEach: match.wallsEach,
        isRanked: true,
        onClockTick: (gId, clock) => this.server.to(gId).emit('game:clock', clock),
        onTimeout: (gId, ended, move) => this.emitTimeoutEnded(gId, ended, move),
      });

      this.setGamePlaying(gameId, true);
      for (const player of orderedPlayers) {
        this.activeGameUserMap.set(player.userId, gameId);
      }
      for (const socket of sockets) {
        socket?.join(gameId);
      }
      // Personalized payload: everyone sees WHO they matched, not just
      // a game id. The finding screen shows the opponent card straight
      // from this instead of a blank connecting page.
      const seats = orderedPlayers.map((player, index) => ({
        userId: player.userId,
        displayName: player.displayName,
        rating: ratings[index] ?? 1500,
      }));
      for (const player of players) {
        this.server
          .to(player.socketId)
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
      try {
        await this.gameService.persistCompleted(payload.gameId);
      } catch (err: any) {
        this.logger.warn(`Completion persist failed ${payload.gameId}: ${err?.message}`);
      }
      this.server.to(payload.gameId).emit('game:ended', result.ended);
      this.setGamePlaying(payload.gameId, false);
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
    // No spectating: only seated players may join a game's channel.
    const existing = this.gameService.getGame(payload.gameId);
    if (!existing || !existing.userPlayerIds[user.userId]) {
      // The usual cause is an identity change between matchmaking and joining:
      // the game is seated with the id captured at matchmaking:find, so a
      // client that re-authenticated under a different id is no longer seated
      // and can never attach. Logged because the client renders this as an
      // indefinite "Connecting to match" with no explanation.
      this.logger.warn(
        `game:join rejected (not seated) socket=${client.id} userId=${user.userId} game=${payload.gameId} ` +
          `known=${existing ? Object.keys(existing.userPlayerIds).join(',') : 'game-not-found'}`
      );
      client.emit('game:error', { code: 'GAME_NOT_IN_PROGRESS', message: 'Game not found.' });
      return;
    }
    client.join(payload.gameId);
    this.activeGameUserMap.set(user.userId, payload.gameId);

    // Reconnect reconciliation: replay the client's unconfirmed tail
    // through validation (never blind). Newly applied moves broadcast so
    // any connected opponent stays exact; illegal ones die here and the
    // final sync below rolls the sender back.
    void (async () => {
      const pendings = (payload.pendingActions ?? []).slice(0, 20);
      for (const p of pendings) {
        if (!p || typeof p.clientActionId !== 'string' || !p.action) continue;
        try {
          const res = await this.gameService.resubmitAction(payload.gameId, user.userId, {
            clientActionId: p.clientActionId,
            action: p.action as GameAction,
          });
          if (res.success && !res.replayed) {
            this.server.to(payload.gameId).emit('game:actionAccepted', res.recorded);
            if (res.finished) {
              this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...res.finished });
            }
            if (res.ended) {
              try {
                await this.gameService.persistCompleted(payload.gameId);
              } catch (err: any) {
                this.logger.warn(`Completion persist failed ${payload.gameId}: ${err?.message}`);
              }
              this.server.to(payload.gameId).emit('game:ended', res.ended);
              this.setGamePlaying(payload.gameId, false);
            }
          }
        } catch {
          // ignore one bad resubmit; the sync below is the truth
        }
      }

      const sync = this.gameService.handleReconnect(payload.gameId, user.userId);
      if (sync) {
        this.server.to(payload.gameId).emit('game:opponentReconnected', { userId: user.userId });
        client.emit('game:sync', sync);
      } else {
        const existingSync = this.gameService.getSyncState(payload.gameId, payload.lastSequence ?? 0);
        if (existingSync) {
          client.emit('game:sync', existingSync);
        } else {
          client.emit('game:error', { code: 'GAME_NOT_IN_PROGRESS', message: 'Game not found.' });
        }
      }
    })();
  }

  @SubscribeMessage('game:action')
  async handleGameAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameId: string; action: GameAction; clientActionId?: string; expectedSequence?: number }
  ) {
    const user = this.getUser(client);
    if (!user.verified) {
      client.emit('game:error', { code: 'UNAUTHENTICATED', message: 'Reconnect and try again.' });
      return;
    }
    const result = await this.gameService.processAction(payload.gameId, user.userId, payload.action, {
      clientActionId: payload.clientActionId,
      expectedSequence: payload.expectedSequence,
    });

    if (result.success) {
      this.server.to(payload.gameId).emit('game:actionAccepted', result.recorded);
      if (result.finished) {
        this.server.to(payload.gameId).emit('game:playerFinished', { gameId: payload.gameId, ...result.finished });
      }
      if (result.ended) {
        try {
          await this.gameService.persistCompleted(payload.gameId);
        } catch (err: any) {
          this.logger.warn(`Completion persist failed ${payload.gameId}: ${err?.message}`);
        }
        this.server.to(payload.gameId).emit('game:ended', result.ended);
        this.setGamePlaying(payload.gameId, false);
      }
    } else {
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
      try {
        await this.gameService.persistCompleted(payload.gameId);
      } catch (err: any) {
        this.logger.warn(`Completion persist failed ${payload.gameId}: ${err?.message}`);
      }
      this.server.to(payload.gameId).emit('game:ended', result.ended);
    } else {
      client.emit('game:error', { code: 'RESIGN_FAILED', message: result.error });
    }
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
        // Both accepted! Create new game and notify players
        const params = result.newGameParams;
        await this.gameService.createGame({
          ...params,
          onClockTick: (gId: string, clock: ClockStateDto) => this.server.to(gId).emit('game:clock', clock),
          onTimeout: (gId: string, ended: GameEndedDto, move: any) =>
            this.emitTimeoutEnded(gId, ended, move as RecordedAction),
        });

        this.setGamePlaying(params.gameId, true);

        for (const p of params.users) {
          this.activeGameUserMap.set(p.userId, params.gameId);
          const socketId = this.userSocketMap.get(p.userId);
          if (socketId) {
            const playerSocket = this.server.sockets.sockets.get(socketId);
            playerSocket?.join(params.gameId);
          }
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
   * Timeout path shares the durability gate: persist-then-emit, so a
   * clocked-out game can never be observed without its full history.
   */
  private emitTimeoutEnded(gId: string, ended: GameEndedDto, move: RecordedAction): void {
    void (async () => {
      try {
        await this.gameService.persistCompleted(gId);
      } catch (err: any) {
        this.logger.warn(`Completion persist failed ${gId}: ${err?.message}`);
      }
      this.server.to(gId).emit('game:actionAccepted', move);
      this.server.to(gId).emit('game:ended', ended);
      this.setGamePlaying(gId, false);
    })();
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
        return { ...s, rating: info?.rating ?? 1500 };
      }),
    };
  }
}
