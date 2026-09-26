import {
  GameAction,
  GameError,
  GameMode,
  GameState,
  RecordedAction,
  applyAction,
  createInitialState,
  playerCountForMode,
  rebuildStateAtStep,
  startingWallsForMode,
} from '@duoorb/game-core';
import { ClockStateDto, GameEndedDto, GameSyncDto } from '@duoorb/protocol';
import {
  Glicko2Service,
  GlickoPlayer,
  RATING_ALGORITHM_VERSION,
  infoWeightForPlayerCount,
} from '../rating/glicko2.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Logger } from '@nestjs/common';

export interface ActiveOnlineGame {
  id: string;
  state: GameState;
  mode: GameMode;
  playerUserIds: Record<string, string>; // playerId ('p1', 'p2') -> userId
  userPlayerIds: Record<string, string>; // userId -> playerId ('p1', 'p2')
  ratings: Record<string, GlickoPlayer>;  // userId -> GlickoPlayer
  clocksMs: Record<string, number>;      // playerId -> remaining ms
  incrementSeconds: number;
  turnStartTimestamp: number;
  /**
   * Whether the countdown is running. False until the first move is accepted,
   * so pairing latency is not charged to the slower player. See createGame.
   */
  clockStarted: boolean;
  timerInterval?: NodeJS.Timeout;
  /** Retained so the clock loop can restart after a mid-game forfeit. */
  onClockTick?: (gameId: string, clock: ClockStateDto) => void;
  onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void;
  disconnectedUsers: Record<string, { disconnectTime: number; timeoutId: NodeJS.Timeout }>;
  rematchOffers: Set<string>;            // userIds who offered/accepted rematch
  isRanked: boolean;
  timeControlMinutes: number;
  wallsEach: number;
  /**
   * Idempotency log: clientActionId → original result. Mobile retries
   * replay instead of double-applying. Capped; entries die with the game.
   */
  seenActions: Map<string, { recorded: RecordedAction; ended?: GameEndedDto }>;
  /**
   * Durability ledger: every accepted move lands here SYNCHRONOUSLY before
   * broadcast, and leaves only after Postgres confirms. Completion flushes
   * whatever remains inside the same transaction, so an observed completed
   * game always has a whole history — no tail can be lost to a crash
   * between the last move and the game end.
   */
  pendingMoves: RecordedAction[];
  /**
   * Computed-at-end data waiting on durable persist. game:ended is only
   * emitted after persistCompleted() commits this — never before.
   * Ratings cover EVERY seated player (1v1 or full multiplayer table).
   */
  pendingCompletion?: {
    reason: GameEndedDto['reason'];
    winnerUserId: string | null;
    updated: Record<string, GlickoPlayer> | undefined; // playerId -> post-game model
    ratingChanges: Record<string, { before: number; after: number; delta: number }>; // by userId
  } | null;
  /**
   * Finished players who explicitly left (game:leave). Leaving never
   * forfeits an earned placement — it only frees the seat and is recorded
   * on game_players.hasLeft at completion.
   */
  leftUserIds: Set<string>;
  /**
   * True once persistGameCreated committed the game row + all seats.
   * Until then every move write-through carries the full seeds (game row
   * AND players), so a crash in the first milliseconds still leaves a
   * recoverable game — never a gameless move or a playerless game.
   */
  createdPersisted?: boolean;
}

export class AuthoritativeGameService {
  private readonly logger = new Logger(AuthoritativeGameService.name);
  private games = new Map<string, ActiveOnlineGame>();
  private ratingService = new Glicko2Service();

  private initialTimeMs(timeControlMinutes: number): number {
    return timeControlMinutes > 0 ? timeControlMinutes * 60 * 1000 : 180000;
  }

  /**
   * (Re)starts the 1-second broadcast/tick loop for a game. The loop never
   * owns time itself — every tick derives remaining time from
   * clocksMs + turnStartTimestamp (deadline math), so stalls only delay
   * broadcasts and timeouts fire from real deadlines.
   */
  private startClockLoop(
    game: ActiveOnlineGame,
    onClockTick?: (gameId: string, clock: ClockStateDto) => void,
    onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void
  ): void {
    if (game.timeControlMinutes <= 0) return;
    if (game.timerInterval) clearInterval(game.timerInterval);
    game.timerInterval = setInterval(() => {
      if (game.state.status !== 'IN_PROGRESS') {
        if (game.timerInterval) clearInterval(game.timerInterval);
        return;
      }

      // Armed but not yet running: no move has been played, so nobody is
      // losing time. See the clockStarted note in createGame.
      if (!game.clockStarted) return;

      const now = Date.now();
      const activePlayerId = game.state.players[game.state.currentPlayerIndex].id;
      const elapsed = now - game.turnStartTimestamp;
      const currentRemaining = Math.max(0, game.clocksMs[activePlayerId] - elapsed);

      if (currentRemaining <= 0) {
        // Timeout reached (always the active side to move — finished
        // players never hold the clock, so they can never time out).
        if (game.timerInterval) clearInterval(game.timerInterval);
        game.clocksMs[activePlayerId] = 0;

        const timeoutRes = applyAction(game.state, { type: 'TIMEOUT' }, {
          timestamp: now,
          clockRemainingMs: 0,
        });

        if (timeoutRes.success) {
          game.state = timeoutRes.state;
          this.ledgerMove(game, timeoutRes.state.lastMove!);
          const ended = this.finalizeGame(game, 'TIMEOUT');
          if (onTimeout) {
            onTimeout(game.id, ended, timeoutRes.state.lastMove!);
          }
        }
        return;
      }

      if (onClockTick) {
        const tickRemainingMs = { ...game.clocksMs };
        tickRemainingMs[activePlayerId] = currentRemaining;
        onClockTick(game.id, {
          activePlayerIndex: game.state.currentPlayerIndex,
          remainingMs: tickRemainingMs,
          serverTimestamp: now,
          incrementSeconds: game.incrementSeconds,
        });
      }
    }, 1000);
  }

  constructor(private readonly prisma?: PrismaService) {
    // Retry sweeper: transient DB blips must not strand moves. Every 15s,
    // re-drive any move still unconfirmed (upserts are idempotent).
    const sweep = setInterval(() => {
      for (const game of this.games.values()) {
        if (game.pendingMoves.length === 0) continue;
        const retry = [...game.pendingMoves];
        for (const move of retry) {
          void this.persistMove(game.id, move)
            .then(() => this.confirmMove(game.id, move.sequence))
            .catch((err) => {
              this.logger.warn(`Move retry failed ${game.id}#${move.sequence}: ${err.message}`);
            });
        }
      }
    }, 15000);
    if (typeof (sweep as unknown as { unref?: unknown }).unref === 'function') {
      (sweep as unknown as { unref: () => void }).unref();
    }
  }

  /**
   * Creates a new authoritative online game and persists record to PostgreSQL.
   */
  public createGame(params: {
    gameId: string;
    mode: GameMode;
    users: { userId: string; displayName: string; rating: GlickoPlayer }[];
    timeControlMinutes: number;
    incrementSeconds?: number;
    wallsEach?: number;
    isRanked: boolean;
    onClockTick?: (gameId: string, clock: ClockStateDto) => void;
    onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void;
  }): ActiveOnlineGame {
    const playerNames = params.users.map((u) => u.displayName);
    const initialState = createInitialState({
      gameId: params.gameId,
      mode: params.mode,
      playerNames,
      wallsEach: params.wallsEach,
    });

    const playerUserIds: Record<string, string> = {};
    const userPlayerIds: Record<string, string> = {};
    const ratings: Record<string, GlickoPlayer> = {};
    const clocksMs: Record<string, number> = {};

    const initialTimeMs = this.initialTimeMs(params.timeControlMinutes);
    const incrementSec = params.incrementSeconds ?? 0;

    params.users.forEach((u, idx) => {
      const playerId = initialState.players[idx].id;
      playerUserIds[playerId] = u.userId;
      userPlayerIds[u.userId] = playerId;
      ratings[u.userId] = u.rating;
      clocksMs[playerId] = initialTimeMs;
    });

    const activeGame: ActiveOnlineGame = {
      id: params.gameId,
      state: initialState,
      mode: params.mode,
      playerUserIds,
      userPlayerIds,
      ratings,
      clocksMs,
      incrementSeconds: incrementSec,
      // The clock does not start until the first move is actually played (see
      // startClockIfPending). Creating a game and pairing two players is
      // instant, but a client still has to attach, receive game:sync and render
      // before it can move. Starting the countdown here charged that latency to
      // whoever attached slowest — and a client that failed to attach entirely
      // (see the game:join rejections in the gateway) simply ran out of time
      // and forfeited a game it never saw.
      turnStartTimestamp: 0,
      clockStarted: false,
      onClockTick: params.onClockTick,
      onTimeout: params.onTimeout,
      disconnectedUsers: {},
      rematchOffers: new Set(),
      isRanked: params.isRanked,
      timeControlMinutes: params.timeControlMinutes,
      wallsEach: params.wallsEach ?? startingWallsForMode(params.mode),
      pendingMoves: [],
      seenActions: new Map(),
      leftUserIds: new Set(),
    };

    this.startClockLoop(activeGame, params.onClockTick, params.onTimeout);

    this.games.set(params.gameId, activeGame);

    // Asynchronously persist game in PostgreSQL
    this.persistGameCreated(activeGame, params.users).catch((err) => {
      this.logger.warn(`Failed to persist game created: ${err.message}`);
    });

    return activeGame;
  }

  public getGame(gameId: string): ActiveOnlineGame | undefined {
    return this.games.get(gameId);
  }

  /**
   * Reconnect resubmission for one pending client action. Never blind:
   * - already applied (memory log or Postgres row) → replay original result
   * - missing but legal right now → validate, apply, persist, broadcast data
   * - illegal against current truth → error so the client rolls back
   * The server always assigns the sequence; client numbers are advisory.
   */
  /**
   * Renames a player in every live game they are seated in.
   *
   * The game state holds its own copy of each player's name (seeded from the
   * matchmaking snapshot at createGame) and previously had no way to be
   * updated, so a rename was invisible for the rest of that game and only
   * appeared in the next one. Returns the ids of the games that changed so the
   * caller can broadcast the new state.
   */
  public setPlayerName(userId: string, displayName: string): string[] {
    if (!displayName) return [];
    const changed: string[] = [];
    for (const game of this.games.values()) {
      if (game.state.status !== 'IN_PROGRESS') continue;
      const playerId = game.userPlayerIds[userId];
      if (!playerId) continue;
      const players = game.state.players.map((p) =>
        p.id === playerId ? { ...p, displayName } : p
      );
      if (players.every((p, i) => p.displayName === game.state.players[i].displayName)) {
        continue;
      }
      game.state = { ...game.state, players };
      changed.push(game.id);
    }
    return changed;
  }

  public async resubmitAction(
    gameId: string,
    userId: string,
    submission: { clientActionId: string; action: GameAction }
  ): Promise<
    | { success: true; recorded: RecordedAction; ended?: GameEndedDto; finished?: { playerId: string; userId: string; place: number }; replayed: boolean }
    | { success: false; error: GameError }
  > {
    const game = this.games.get(gameId);
    if (!game || game.state.status !== 'IN_PROGRESS') {
      return { success: false, error: { code: 'GAME_NOT_IN_PROGRESS', message: 'Game not found.' } };
    }
    if (!game.userPlayerIds[userId]) {
      return { success: false, error: { code: 'NOT_YOUR_TURN', message: 'Not a player in this game.' } };
    }

    const seen = game.seenActions.get(submission.clientActionId);
    if (seen) {
      return { success: true, recorded: seen.recorded, ended: seen.ended, replayed: true };
    }

    if (this.prisma?.isConnected) {
      const row = await this.prisma.gameMove.findFirst({
        where: { gameId, clientActionId: submission.clientActionId },
      });
      if (row) {
        const recorded: RecordedAction = {
          sequence: row.sequence,
          playerId: `p${row.playerIndex + 1}`,
          action: row.payload as unknown as GameAction,
          timestamp: Number(row.serverTimestamp),
          clockRemainingMs: row.clockRemainingMs,
          clientActionId: submission.clientActionId,
        };
        game.seenActions.set(submission.clientActionId, { recorded });
        return { success: true, recorded, replayed: true };
      }
    }

    const result = this.processAction(gameId, userId, submission.action, {
      clientActionId: submission.clientActionId,
    });
    return result.success
      ? { success: true, recorded: result.recorded, ended: result.ended, finished: result.finished, replayed: false }
      : { success: false, error: result.error };
  }

  /**
   * Rebuilds one IN_PROGRESS game purely from its Postgres rows, through
   * the single authoritative path (createInitialState + applyAction loop
   * via rebuildStateAtStep — no second reconstruction algorithm).
   * Throws with the exact reason when reconstruction is unsafe; callers
   * must then mark the game ABANDONED, never invent state.
   */
  public async reconstructGame(
    row: {
      id: string;
      mode: string;
      timeControlMinutes: number;
      incrementSeconds: number;
      wallsEach: number | null;
      isRanked: boolean;
    },
    playerRows: {
      userId: string;
      playerIndex: number;
      ratingBefore: number | null;
      rdBefore: number | null;
      volBefore: number | null;
      displayName: string;
    }[],
    moveRows: {
      sequence: number;
      playerIndex: number;
      actionType: string;
      payload: unknown;
      clockRemainingMs: number;
      serverTimestamp: bigint | number;
      clientActionId: string | null;
    }[]
  ): Promise<{ game: ActiveOnlineGame; completed: boolean }> {
    const mode = row.mode as GameMode;
    const orderedPlayers = [...playerRows].sort((a, b) => a.playerIndex - b.playerIndex);
    if (orderedPlayers.length === 0) {
      throw new Error('no players persisted');
    }
    const wallsEach = row.wallsEach ?? startingWallsForMode(mode);

    const initialState = createInitialState({
      gameId: row.id,
      mode,
      playerNames: orderedPlayers.map((p) => p.displayName),
      wallsEach,
    });
    if (initialState.players.length !== orderedPlayers.length) {
      throw new Error(
        `player count mismatch: mode needs ${initialState.players.length}, rows have ${orderedPlayers.length}`
      );
    }

    const orderedMoves = [...moveRows].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < orderedMoves.length; i++) {
      if (orderedMoves[i].sequence !== i + 1) {
        throw new Error(`sequence gap: expected ${i + 1}, found ${orderedMoves[i].sequence}`);
      }
    }
    const recorded: RecordedAction[] = orderedMoves.map((m) => ({
      sequence: m.sequence,
      playerId: `p${m.playerIndex + 1}`,
      action: m.payload as unknown as GameAction,
      timestamp: Number(m.serverTimestamp),
      clockRemainingMs: m.clockRemainingMs,
      clientActionId: m.clientActionId ?? undefined,
    }));
    const state = rebuildStateAtStep(initialState, recorded, recorded.length);
    // A replay that ends COMPLETED is not corruption — it is a game whose
    // end was accepted (and broadcast) but whose completion never committed
    // (crash in the old fire-and-forget era). The caller finishes it
    // properly instead of abandoning a real result.
    const completed = state.status !== 'IN_PROGRESS';

    // Clocks: latest known remaining per player; downtime is paused time —
    // the turn restarts now instead of billing players for the outage.
    const initialMs = this.initialTimeMs(row.timeControlMinutes);
    const clocksMs: Record<string, number> = {};
    for (const p of state.players) {
      const last = [...recorded].reverse().find((m) => m.playerId === p.id);
      clocksMs[p.id] = last?.clockRemainingMs ?? initialMs;
    }

    const playerUserIds: Record<string, string> = {};
    const userPlayerIds: Record<string, string> = {};
    const ratings: Record<string, GlickoPlayer> = {};
    orderedPlayers.forEach((pr, idx) => {
      const playerId = state.players[idx].id;
      playerUserIds[playerId] = pr.userId;
      userPlayerIds[pr.userId] = playerId;
      ratings[pr.userId] = {
        rating: pr.ratingBefore ?? 1500,
        rd: pr.rdBefore ?? 350,
        vol: pr.volBefore ?? 0.06,
      };
    });

    return {
      game: {
        id: row.id,
        state,
        mode,
        playerUserIds,
        userPlayerIds,
        ratings,
        clocksMs,
        incrementSeconds: row.incrementSeconds,
        turnStartTimestamp: Date.now(),
        // A recovered game was already under way before the restart, so its
        // clock resumes immediately rather than waiting for a first move.
        clockStarted: true,
        disconnectedUsers: {},
        rematchOffers: new Set(),
        isRanked: row.isRanked,
        timeControlMinutes: row.timeControlMinutes,
        wallsEach,
        pendingMoves: [],
        seenActions: new Map(),
        leftUserIds: new Set(),
      },
      completed,
    };
  }

  /**
   * Startup recovery: reload every IN_PROGRESS game from Postgres and put
   * it back into the authoritative map with its clock loop running.
   * Unreconstructable games are marked ABANDONED with the exact reason —
   * never silently invented. Returns { recovered, abandoned }.
   */
  public async recoverInProgressGames(hooks: {
    onClockTick?: (gameId: string, clock: ClockStateDto) => void;
    onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void;
  } = {}): Promise<{ recovered: number; abandoned: string[] }> {
    // afterInit fires before Postgres is reachable on fresh boots — wait
    // for the connection instead of concluding "nothing to recover".
    for (let i = 0; i < 15; i++) {
      if (this.prisma?.isConnected) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!this.prisma || !this.prisma.isConnected) {
      this.logger.warn('Recovery skipped: database unavailable.');
      return { recovered: 0, abandoned: [] };
    }
    const rows = await this.prisma.game.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        players: { include: { user: { include: { profile: true } } } },
        moves: { orderBy: { sequence: 'asc' } },
      },
    });

    let recovered = 0;
    const abandoned: string[] = [];
    for (const row of rows) {
      try {
        const playerRows = row.players.map((p: any) => ({
          userId: p.userId as string,
          playerIndex: p.playerIndex as number,
          ratingBefore: (p.ratingBefore as number | null) ?? null,
          rdBefore: (p.rdBefore as number | null) ?? null,
          volBefore: (p.volBefore as number | null) ?? null,
          // username first, for the same reason as everywhere else: a
          // recovered game previously showed the auto-generated guest handle
          // where the original had shown the chosen username, so the same game
          // changed names across a server restart.
          displayName:
            (p.user?.profile?.username as string | undefined) ??
            (p.user?.profile?.displayName as string | undefined) ??
            `Player ${(p.userId as string).slice(0, 4)}`,
        }));
        const moveRows = row.moves.map((m: any) => ({
          sequence: m.sequence as number,
          playerIndex: m.playerIndex as number,
          actionType: m.actionType as string,
          payload: m.payload,
          clockRemainingMs: m.clockRemainingMs as number,
          serverTimestamp: m.serverTimestamp as bigint | number,
          clientActionId: (m.clientActionId as string | null) ?? null,
        }));
        const { game, completed } = await this.reconstructGame(
          {
            id: row.id,
            mode: row.mode,
            timeControlMinutes: row.timeControlMinutes,
            incrementSeconds: row.incrementSeconds,
            wallsEach: (row as any).wallsEach ?? null,
            isRanked: row.isRanked,
          },
          playerRows,
          moveRows
        );
        if (completed) {
          // Ended pre-crash but never committed: finish it now (idempotent
          // upserts — a duplicate completion is a NO-OP, never double rating).
          const last = game.state.history[game.state.history.length - 1];
          const reason =
            last?.action.type === 'RESIGN'
              ? 'RESIGNATION'
              : last?.action.type === 'TIMEOUT'
              ? 'TIMEOUT'
              : 'GOAL_REACHED';
          this.finalizeGame(game, reason as GameEndedDto['reason']);
          await this.persistCompleted(game.id);
        }
        this.games.set(game.id, game);
        game.onClockTick = hooks.onClockTick;
        game.onTimeout = hooks.onTimeout;
        this.startClockLoop(game, hooks.onClockTick, hooks.onTimeout);
        recovered++;
        this.logger.log(`Recovered in-progress game ${game.id} at sequence ${moveRows.length}.`);
      } catch (err: any) {
        abandoned.push(row.id);
        this.logger.error(`Game ${row.id} unrecoverable (${err?.message}); marking ABANDONED.`);
        try {
          await this.prisma.game.update({
            where: { id: row.id },
            data: { status: 'ABANDONED' },
          });
        } catch {
          // leave it for the next boot
        }
      }
    }
    return { recovered, abandoned };
  }

  /**
   * Ledgers one accepted move for durability: synchronous list append
   * first, async write-through second. Shared by processAction and the
   * clock/disconnect forfeit paths so EVERY history row is covered.
   */
  private ledgerMove(game: ActiveOnlineGame, recordedMove: RecordedAction): void {
    game.pendingMoves.push(recordedMove);
    void this.persistMove(game.id, recordedMove)
      .then(() => this.confirmMove(game.id, recordedMove.sequence))
      .catch((err) => {
        // Stays ledgered: the sweeper retries, and completion flushes.
        this.logger.warn(`Move ${game.id}#${recordedMove.sequence} pending: ${err.message}`);
      });
  }
  private confirmMove(gameId: string, sequence: number): void {
    const game = this.games.get(gameId);
    if (!game) return;
    game.pendingMoves = game.pendingMoves.filter((m) => m.sequence !== sequence);
  }

  /**
   * Writes one move durably (upsert: retries and double-delivery are
   * no-ops thanks to UNIQUE(gameId, sequence)).
   *
   * Two races hardened here, both observed live:
   * - Moves can arrive milliseconds after creation, before the async
   *   persistGameCreated lands → parent row missing → FK violation. So the
   *   parent game row is upserted first (update:{} — an existing, possibly
   *   COMPLETED row is never clobbered).
   * - The fire-and-forget write-through in processAction can race the
   *   completion flushMoves on the same (gameId, sequence). Prisma upserts
   *   are read-then-write, so the loser gets P2002. Sequences are assigned
   *   synchronously in memory, so the same key always means the same move:
   *   P2002 is treated as confirmed.
   */
  private async persistMove(gameId: string, move: RecordedAction): Promise<void> {
    if (!this.prisma || !this.prisma.isConnected) {
      throw new Error('Database unavailable.');
    }

    const game = this.games.get(gameId);
    if (game && !game.createdPersisted) {
      // Seed the parent game row AND every seat first: moves can arrive
      // milliseconds after creation, before the async persistGameCreated
      // lands. Upserts with update:{} never clobber existing rows, and
      // once creation confirms, this block stops running entirely.
      await this.prisma.game.upsert({
        where: { id: gameId },
        create: {
          id: gameId,
          mode: game.mode,
          status: 'IN_PROGRESS',
          isRanked: game.isRanked,
          timeControlMinutes: game.timeControlMinutes,
          incrementSeconds: game.incrementSeconds,
          wallsEach: game.wallsEach,
          rulesetVersion: '1.0.0',
          startedAt: new Date(),
        },
        update: {},
      });
      for (const [playerId, uId] of Object.entries(game.playerUserIds)) {
        const pIdx = game.state.players.findIndex((p) => p.id === playerId);
        const r = game.ratings[uId];
        await this.prisma.gamePlayer.upsert({
          where: { gameId_userId: { gameId, userId: uId } },
          create: {
            gameId,
            userId: uId,
            playerIndex: pIdx >= 0 ? pIdx : 0,
            ratingBefore: r?.rating ?? null,
            rdBefore: r?.rd ?? null,
            volBefore: r?.vol ?? null,
          },
          update: {},
        });
      }
    }

    const playerIndex = parseInt(move.playerId.replace('p', ''), 10) - 1 || 0;

    try {
      await this.prisma.gameMove.upsert({
        where: { gameId_sequence: { gameId, sequence: move.sequence } },
        create: {
          gameId,
          sequence: move.sequence,
          playerIndex,
          actionType: move.action.type,
          payload: move.action as any,
          clockRemainingMs: move.clockRemainingMs ?? 0,
          serverTimestamp: BigInt(move.timestamp),
          clientActionId: move.clientActionId ?? null,
        },
        update: {},
      });
    } catch (err: any) {
      if (err?.code === 'P2002') return;
      throw err;
    }
  }

  /**
   * Flushes every still-unconfirmed move of a game. Called inside game
   * completion before anything else persists, so a completed game can
   * never be stored with a hole in its history.
   */
  private async flushMoves(game: ActiveOnlineGame): Promise<void> {
    const pending = [...game.pendingMoves];
    for (const move of pending) {
      await this.persistMove(game.id, move);
      this.confirmMove(game.id, move.sequence);
    }
  }

  /**
   * Migrates every live reference of an old user id to a new one
   * (guest → signed-in account). Seats, clocks-by-player and ratings move
   * with the player, so an in-progress game survives sign-in.
   */
  public migrateUser(oldUserId: string, newUserId: string): void {
    if (oldUserId === newUserId) return;
    for (const game of this.games.values()) {
      let changed = false;
      for (const [playerId, uId] of Object.entries(game.playerUserIds)) {
        if (uId === oldUserId) {
          game.playerUserIds[playerId] = newUserId;
          changed = true;
        }
      }
      if (game.userPlayerIds[oldUserId] !== undefined) {
        game.userPlayerIds[newUserId] = game.userPlayerIds[oldUserId];
        delete game.userPlayerIds[oldUserId];
        changed = true;
      }
      if (game.ratings[oldUserId] !== undefined) {
        game.ratings[newUserId] = game.ratings[oldUserId];
        delete game.ratings[oldUserId];
        changed = true;
      }
      if (game.disconnectedUsers[oldUserId] !== undefined) {
        game.disconnectedUsers[newUserId] = game.disconnectedUsers[oldUserId];
        delete game.disconnectedUsers[oldUserId];
        changed = true;
      }
      if (game.rematchOffers.has(oldUserId)) {
        game.rematchOffers.delete(oldUserId);
        game.rematchOffers.add(newUserId);
        changed = true;
      }
      if (game.leftUserIds.has(oldUserId)) {
        game.leftUserIds.delete(oldUserId);
        game.leftUserIds.add(newUserId);
        changed = true;
      }
      if (changed) {
        this.logger.log(`Migrated live game ${game.id}: ${oldUserId} -> ${newUserId}`);
      }
    }
  }

  /**
   * Authoritatively processes a player action.
   *
   * CONCURRENCY: everything from the status check below through the state
   * mutation and finalizeGame is fully synchronous — zero awaits — so in
   * Node's single thread two concurrent requests cannot interleave. The
   * second one always observes COMPLETED and is rejected. The database
   * half is hardened independently (UNIQUE(gameId, userId) on
   * rating_history + replay-safe persist), so retries/restarts can never
   * double-apply ratings either.
   */
  public processAction(
    gameId: string,
    userId: string,
    action: GameAction,
    opts?: { clientActionId?: string; expectedSequence?: number }
  ): { success: true; recorded: RecordedAction; ended?: GameEndedDto; finished?: { playerId: string; userId: string; place: number } } | { success: false; error: GameError } {
    const game = this.games.get(gameId);
    if (!game) {
      return { success: false, error: { code: 'GAME_NOT_IN_PROGRESS', message: 'Game not found.' } };
    }

    if (game.state.status !== 'IN_PROGRESS') {
      return { success: false, error: { code: 'GAME_NOT_IN_PROGRESS', message: 'Game has already ended.' } };
    }

    // Mobile-network retry safety: the same clientActionId replays the
    // original result instead of applying twice. The server alone assigns
    // sequence numbers; the client key is idempotency-only.
    if (opts?.clientActionId) {
      const seen = game.seenActions.get(opts.clientActionId);
      if (seen) {
        return { success: true, recorded: seen.recorded, ended: seen.ended };
      }
    }

    // Stale-view guard: when the client states its expected next sequence
    // and it disagrees with ours, reject so it resyncs instead of acting
    // on a board that no longer exists.
    const serverNext = game.state.history.length + 1;
    if (opts?.expectedSequence !== undefined && opts.expectedSequence !== serverNext) {
      return { success: false, error: { code: 'STALE_SEQUENCE', message: 'Stale view — resync and retry.' } };
    }

    const expectedPlayerId = game.state.players[game.state.currentPlayerIndex].id;
    const senderPlayerId = game.userPlayerIds[userId];

    // Finished players spectate: they can observe but never act again.
    // Checked before the turn gate so they get the honest error code
    // (a finished seat never holds the turn, so the turn gate would
    // otherwise mask it as NOT_YOUR_TURN).
    if (senderPlayerId) {
      const sender = game.state.players.find((p) => p.id === senderPlayerId);
      if (sender && sender.status === 'FINISHED') {
        return { success: false, error: { code: 'ALREADY_FINISHED', message: 'You have already finished this game.' } };
      }
    }

    if (action.type !== 'RESIGN' && senderPlayerId !== expectedPlayerId) {
      return { success: false, error: { code: 'NOT_YOUR_TURN', message: 'It is not your turn to move.' } };
    }

    const now = Date.now();

    // Deduct elapsed time from moving player
    if (game.timeControlMinutes > 0) {
      // Arm on the very first move so the time spent attaching to the game is
      // never charged. turnStartTimestamp is 0 until then, which would
      // otherwise read as "the clock has been running since the epoch" and
      // instantly zero the clock.
      if (!game.clockStarted) {
        game.clockStarted = true;
        game.turnStartTimestamp = now;
      }
      const elapsed = now - game.turnStartTimestamp;
      game.clocksMs[expectedPlayerId] = Math.max(0, game.clocksMs[expectedPlayerId] - elapsed);

      // Add Fischer increment after move completion (if not timeout or resign)
      if (action.type !== 'RESIGN' && action.type !== 'TIMEOUT' && game.incrementSeconds > 0) {
        game.clocksMs[expectedPlayerId] += game.incrementSeconds * 1000;
      }
    }

    // Apply action via game-core rules (RESIGN carries its actor so an
    // off-turn resignation crowns the right opponent).
    const result = applyAction(game.state, action, {
      timestamp: now,
      clockRemainingMs: game.clocksMs[expectedPlayerId],
      actorId: action.type === 'RESIGN' ? senderPlayerId : undefined,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const placementsBefore = game.state.placements.length;
    game.state = result.state;
    game.turnStartTimestamp = now;

    const recordedMove: RecordedAction = {
      ...result.state.lastMove!,
      clientActionId: opts?.clientActionId,
    };

    // Durability ledger first (synchronous — survives anything after this
    // line), write-through second. Player latency is untouched: nothing
    // here is awaited before responding.
    this.ledgerMove(game, recordedMove);

    // Finish broadcast data: whenever this action earned the actor a place
    // (mid-game finish or the decisive final finish), the gateway tells
    // the room. The auto-assigned last place belongs to a bystander, so
    // only the actor's own new entry is reported; completion separately
    // emits ended with the full order.
    let finished: { playerId: string; userId: string; place: number } | undefined;
    if (result.state.placements.length > placementsBefore) {
      const actorPlayerId = result.state.lastMove!.playerId;
      const mine = result.state.placements
        .slice(placementsBefore)
        .find((p) => p.playerId === actorPlayerId);
      if (mine) {
        finished = { playerId: mine.playerId, userId: game.playerUserIds[mine.playerId], place: mine.place };
      }
    }

    let ended: GameEndedDto | undefined;
    if (result.state.status === 'COMPLETED') {
      if (game.timerInterval) clearInterval(game.timerInterval);
      const reason = action.type === 'RESIGN' ? 'RESIGNATION' : 'GOAL_REACHED';
      ended = this.finalizeGame(game, reason);
    }

    if (opts?.clientActionId) {
      game.seenActions.set(opts.clientActionId, { recorded: recordedMove, ended });
      if (game.seenActions.size > 100) {
        const oldest = game.seenActions.keys().next();
        if (!oldest.done) game.seenActions.delete(oldest.value);
      }
    }

    return { success: true, recorded: recordedMove, ended, finished };
  }

  /**
   * Resigns a game on behalf of a player. In multiplayer this may merely
   * finish the resigner (worst remaining place) while the match continues —
   * callers must handle both ended and finished.
   */
  public resign(gameId: string, userId: string): { success: true; recorded: RecordedAction; ended?: GameEndedDto; finished?: { playerId: string; userId: string; place: number } } | { success: false; error: string } {
    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found.' };

    const senderPlayerId = game.userPlayerIds[userId];
    if (!senderPlayerId) return { success: false, error: 'User is not a player in this game.' };

    const res = this.processAction(gameId, userId, { type: 'RESIGN' });
    if (!res.success) return { success: false, error: res.error.message };

    return { success: true, recorded: res.recorded, ended: res.ended, finished: res.finished };
  }

  /**
   * Explicit leave. Finished players walk away with their placement intact
   * (seat freed, no forfeit); active players forfeit via the resign path.
   */
  public leaveGame(gameId: string, userId: string): { left: true; forfeited: boolean; recorded?: RecordedAction; ended?: GameEndedDto; finished?: { playerId: string; userId: string; place: number } } | { left: false; error: string } {
    const game = this.games.get(gameId);
    if (!game) return { left: false, error: 'Game not found.' };
    if (game.state.status !== 'IN_PROGRESS') return { left: true, forfeited: false };

    const senderPlayerId = game.userPlayerIds[userId];
    if (!senderPlayerId) return { left: false, error: 'User is not a player in this game.' };

    const seat = game.state.players.find((p) => p.id === senderPlayerId);
    if (seat && seat.status === 'FINISHED') {
      game.leftUserIds.add(userId);
      return { left: true, forfeited: false };
    }

    const res = this.processAction(gameId, userId, { type: 'RESIGN' });
    if (!res.success) return { left: false, error: res.error.message };
    return { left: true, forfeited: true, recorded: res.recorded, ended: res.ended, finished: res.finished };
  }

  /**
   * Handles rematch offers. Returns new game info if both accepted.
   */
  public offerRematch(gameId: string, userId: string): { offered: true; newGameParams?: any } | { offered: false; error: string } {
    const game = this.games.get(gameId);
    if (!game) return { offered: false, error: 'Game not found.' };
    if (game.state.status !== 'COMPLETED') return { offered: false, error: 'Game still in progress.' };

    const senderPlayerId = game.userPlayerIds[userId];
    if (!senderPlayerId) return { offered: false, error: 'Not a player in this game.' };

    game.rematchOffers.add(userId);

    const totalPlayers = Object.keys(game.userPlayerIds).length;
    if (game.rematchOffers.size >= totalPlayers) {
      // Both accepted! Swap player colors / orders for the rematch
      const u1 = game.playerUserIds['p1'];
      const u2 = game.playerUserIds['p2'];

      const newGameId = `game-rematch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const swappedUsers = [
        { userId: u2, displayName: `Player ${u2.slice(0, 4)}`, rating: game.ratings[u2] },
        { userId: u1, displayName: `Player ${u1.slice(0, 4)}`, rating: game.ratings[u1] },
      ];

      return {
        offered: true,
        newGameParams: {
          gameId: newGameId,
          mode: game.mode,
          users: swappedUsers,
          timeControlMinutes: game.timeControlMinutes,
          incrementSeconds: game.incrementSeconds,
          isRanked: game.isRanked,
        },
      };
    }

    return { offered: true };
  }

  /**
   * Handles player disconnection and sets up a grace period timer.
   *
   * A FINISHED player's disconnect is never a forfeit — they already
   * earned their placement, so no timer is armed at all (returns null and
   * the gateway stays silent). An ACTIVE player who never returns forfeits
   * through the engine: worst remaining place in multiplayer (the match
   * continues), immediate loss in 1v1 (unchanged).
   */
  public handleDisconnect(
    gameId: string,
    userId: string,
    onForfeit: (ended: GameEndedDto | null, finished?: { playerId: string; userId: string; place: number }, lastMove?: RecordedAction) => void
  ): { gracePeriodSeconds: number } | null {
    const game = this.games.get(gameId);
    if (!game || game.state.status !== 'IN_PROGRESS') return null;

    const playerId = game.userPlayerIds[userId];
    if (!playerId) return null;

    const seat = game.state.players.find((p) => p.id === playerId);
    if (!seat || seat.status === 'FINISHED') return null;

    const graceSeconds = game.isRanked ? 60 : 30;

    const timeoutId = setTimeout(() => {
      delete game.disconnectedUsers[userId];
      const g = this.games.get(gameId);
      if (!g || g.state.status !== 'IN_PROGRESS') return;
      const seatNow = g.state.players.find((p) => p.id === playerId);
      if (!seatNow || seatNow.status === 'FINISHED') return;
      // Disconnect forfeit = TIMEOUT by the absent player (works off-turn).
      const res = applyAction(g.state, { type: 'TIMEOUT' }, {
        timestamp: Date.now(),
        clockRemainingMs: 0,
        actorId: playerId,
      });
      if (!res.success) return;
      g.state = res.state;
      g.clockStarted = true;
      g.turnStartTimestamp = Date.now();
      this.ledgerMove(g, res.state.lastMove!);
      if (res.state.status !== 'COMPLETED') {
        if (g.timerInterval) { clearInterval(g.timerInterval); }
        this.startClockLoop(g, g.onClockTick, g.onTimeout);
        const last = res.state.placements[res.state.placements.length - 1];
        onForfeit(null, { playerId: last.playerId, userId: g.playerUserIds[last.playerId], place: last.place }, res.state.lastMove!);
        return;
      }
      if (g.timerInterval) clearInterval(g.timerInterval);
      const ended = this.finalizeGame(g, 'DISCONNECT');
      onForfeit(ended, undefined, res.state.lastMove!);
    }, graceSeconds * 1000);

    game.disconnectedUsers[userId] = {
      disconnectTime: Date.now(),
      timeoutId,
    };

    return { gracePeriodSeconds: graceSeconds };
  }

  /**
   * Handles player reconnect, cancels grace timer, and returns sync state.
   */
  public handleReconnect(gameId: string, userId: string): GameSyncDto | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    if (game.disconnectedUsers[userId]) {
      clearTimeout(game.disconnectedUsers[userId].timeoutId);
      delete game.disconnectedUsers[userId];
    }

    return this.getSyncState(gameId, 0);
  }

  /**
   * Resynchronizes a player on reconnect with authoritative state and missing moves.
   */
  public getSyncState(gameId: string, lastSequence = 0): GameSyncDto | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const missing = game.state.history.filter((m) => m.sequence > lastSequence);
    const clockDto: ClockStateDto = {
      activePlayerIndex: game.state.currentPlayerIndex,
      remainingMs: game.clocksMs,
      serverTimestamp: Date.now(),
      incrementSeconds: game.incrementSeconds,
    };

    return {
      state: game.state,
      clock: clockDto,
      missingActions: missing,
      playerUserIds: game.playerUserIds,
    };
  }

  /**
   * Finalizes a game and computes the universal rating update — once, at
   * real completion, for every seated player. Mid-game finishes change
   * nothing: rating waits until all placements are known.
   *
   * 1v1 (any 2-player mode): classic head-to-head Glicko-2, full weight.
   * Multiplayer: virtual round-robin over the complete placement order
   * with the tuned table-size information weight (3P ≈ 75%, 4P ≈ 57%).
   */
  public finalizeGame(game: ActiveOnlineGame, reason: GameEndedDto['reason']): GameEndedDto {
    const winnerId = game.state.winnerId;
    const winnerUserId = winnerId ? game.playerUserIds[winnerId] : null;
    const ratingChanges: Record<string, { before: number; after: number; delta: number }> = {};
    let updated: Record<string, GlickoPlayer> | undefined;
    const seats = game.state.players;

    if (game.isRanked) {
      const before = new Map<string, GlickoPlayer>();
      for (const p of seats) {
        const uId = game.playerUserIds[p.id];
        before.set(p.id, game.ratings[uId] || { rating: 1500, rd: 350, vol: 0.06 });
      }
      if (seats.length === 2) {
        const [s1, s2] = seats;
        const u1 = game.playerUserIds[s1.id];
        const u2 = game.playerUserIds[s2.id];
        const score: 1.0 | 0.5 | 0.0 = winnerId === s1.id ? 1.0 : winnerId === s2.id ? 0.0 : 0.5;
        const res = this.ratingService.update1v1(before.get(s1.id)!, before.get(s2.id)!, score);
        updated = { [s1.id]: res.p1, [s2.id]: res.p2 };
      } else {
        // Multiplayer: ranks come from final placements. The engine
        // guarantees a complete order at COMPLETED (last active auto-placed).
        const ranks = seats.map((p) => ({
          player: before.get(p.id)!,
          rank: p.place ?? seats.length,
        }));
        const after = this.ratingService.updateMultiplayer(ranks, infoWeightForPlayerCount(seats.length));
        updated = {};
        seats.forEach((p, i) => {
          updated![p.id] = after[i];
        });
      }
      for (const p of seats) {
        const uId = game.playerUserIds[p.id];
        const b = before.get(p.id)!;
        const a = updated[p.id];
        ratingChanges[uId] = { before: b.rating, after: a.rating, delta: a.rating - b.rating };
      }
    }

    // Stash for the durable step: game:ended is emitted only AFTER
    // persistCompleted() commits moves + completion atomically.
    game.pendingCompletion = { reason, winnerUserId, updated, ratingChanges };

    // Schedule in-memory TTL cleanup after 15 minutes
    setTimeout(() => {
      this.games.delete(game.id);
    }, 15 * 60 * 1000);

    const placements =
      seats.length > 2
        ? seats
            .filter((p) => p.place !== null)
            .map((p) => ({ playerId: p.id, userId: game.playerUserIds[p.id], place: p.place as number }))
            .sort((a, b) => a.place - b.place)
        : undefined;

    return {
      gameId: game.id,
      winnerId,
      reason,
      endedAt: Date.now(),
      ratingChanges,
      placements,
    };
  }

  /**
   * Durable completion gate. Flushes every unconfirmed move, then commits
   * the game/players/ratings in one transaction. Callers MUST await this
   * before emitting game:ended — that ordering is the whole guarantee:
   * any client-observable completed game is whole in Postgres.
   * Throws on DB failure so callers can decide (log + emit anyway to
   * preserve availability; the retry sweeper keeps driving the ledger).
   */
  public async persistCompleted(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (!game || !game.pendingCompletion) return;
    await this.flushMoves(game);
    const { reason, winnerUserId, updated, ratingChanges } = game.pendingCompletion;
    await this.persistGameCompleted(game, reason, winnerUserId, updated, ratingChanges);
    game.pendingCompletion = null;
  }

  private async persistGameCreated(
    game: ActiveOnlineGame,
    users: { userId: string; rating: GlickoPlayer }[]
  ) {
    if (!this.prisma || !this.prisma.isConnected) return;

    // Token-less sockets never ran getOrCreateUser — ensure User rows so
    // the GamePlayer foreign keys cannot fail.
    for (const u of users) {
      await this.prisma.user.upsert({
        where: { id: u.userId },
        create: { id: u.userId },
        update: {},
      });
    }

    // Upsert, never create: a move's write-through may already have stubbed
    // the parent row (see persistMove). Players are upserted separately so
    // they exist even when the stub won the race.
    await this.prisma.game.upsert({
      where: { id: game.id },
      create: {
        id: game.id,
        mode: game.mode,
        status: 'IN_PROGRESS',
        isRanked: game.isRanked,
        timeControlMinutes: game.timeControlMinutes,
        incrementSeconds: game.incrementSeconds,
        wallsEach: game.wallsEach,
        rulesetVersion: '1.0.0',
        startedAt: new Date(),
      },
      update: {},
    });
    for (const [idx, u] of users.entries()) {
      await this.prisma.gamePlayer.upsert({
        where: { gameId_userId: { gameId: game.id, userId: u.userId } },
        create: {
          gameId: game.id,
          userId: u.userId,
          playerIndex: idx,
          ratingBefore: u.rating.rating,
          rdBefore: u.rating.rd,
          volBefore: u.rating.vol,
        },
        update: {},
      });
    }
    game.createdPersisted = true;
  }

  private async persistGameCompleted(
    game: ActiveOnlineGame,
    reason: string,
    winnerUserId: string | null,
    updatedRatings?: Record<string, GlickoPlayer>,
    ratingChanges: Record<string, { before: number; after: number; delta: number }> = {}
  ) {
    if (!this.prisma || !this.prisma.isConnected) return;

    await this.prisma.$transaction(async (tx) => {
      // 1. Upsert Game record (upsert — never assume the created-row won
      // the race; a resignation seconds after start must still persist).
      await tx.game.upsert({
        where: { id: game.id },
        create: {
          id: game.id,
          mode: game.mode,
          status: 'COMPLETED',
          isRanked: game.isRanked,
          timeControlMinutes: game.timeControlMinutes,
          incrementSeconds: game.incrementSeconds,
          rulesetVersion: '1.0.0',
          winnerId: game.state.winnerId,
          winnerUserId,
          endedReason: reason,
          endedAt: new Date(),
        },
        update: {
          status: 'COMPLETED',
          winnerId: game.state.winnerId,
          winnerUserId,
          endedReason: reason,
          endedAt: new Date(),
        },
      });

      // 2. Upsert GamePlayers with the full result: placement for every
      // seat (never winner-only), rating values, and left flags.
      for (const [playerId, uId] of Object.entries(game.playerUserIds)) {
        const seat = game.state.players.find((p) => p.id === playerId);
        const isWinner = playerId === game.state.winnerId;
        const change = ratingChanges[uId];
        const pIdx = game.state.players.findIndex((p) => p.id === playerId);
        await tx.gamePlayer.upsert({
          where: { gameId_userId: { gameId: game.id, userId: uId } },
          create: {
            gameId: game.id,
            userId: uId,
            playerIndex: pIdx >= 0 ? pIdx : 0,
            ratingBefore: game.ratings[uId]?.rating ?? null,
            ratingAfter: change?.after ?? null,
            isWinner,
            placement: seat?.place ?? null,
            hasLeft: game.leftUserIds.has(uId),
          },
          update: {
            ratingAfter: change?.after,
            isWinner,
            placement: seat?.place ?? null,
            hasLeft: game.leftUserIds.has(uId),
          },
        });
      }

      // 3. Universal rating: ONE row per user moved by this game, plus one
      // append-only history entry per participant (vol + algorithm stamped
      // for audit). Replay-safe: a completed game that reaches this function
      // twice finds its history row and skips the counters, so
      // gamesPlayed/wins can never double-count. Concurrent duplicates
      // collide on UNIQUE(gameId, userId) and roll back atomically.
      // Unranked games (AI/local never reach here — server games are online
      // humans) skip this section: updatedRatings is undefined without changes.
      const seats = game.state.players;
      const total = seats.length;
      for (const seat of seats) {
        const uId = game.playerUserIds[seat.id];
        const updated = updatedRatings?.[seat.id];
        const change = ratingChanges[uId];
        if (!change || !updated) continue;
        const already = await tx.ratingHistory.findUnique({
          where: { gameId_userId: { gameId: game.id, userId: uId } },
        });
        if (already) continue; // second request → NO-OP
        // 1v1: win/loss/draw from the winner. Multiplayer: 1st counts as a
        // win, last alone as a loss, middle places as neither.
        const place = seat.place ?? total;
        const isWin = total === 2 ? uId === winnerUserId : place === 1;
        const isDraw = total === 2 ? !winnerUserId : false;
        const isLoss = total === 2 ? !isWin && !isDraw : place === total && total > 1;

        // Upsert the single universal rating row.
        await tx.rating.upsert({
          where: { userId: uId },
          create: {
            userId: uId,
            rating: updated.rating,
            rd: updated.rd,
            vol: updated.vol,
            gamesPlayed: 1,
            wins: isWin ? 1 : 0,
            losses: isLoss ? 1 : 0,
            draws: isDraw ? 1 : 0,
          },
          update: {
            rating: updated.rating,
            rd: updated.rd,
            vol: updated.vol,
            gamesPlayed: { increment: 1 },
            wins: isWin ? { increment: 1 } : undefined,
            losses: isLoss ? { increment: 1 } : undefined,
            draws: isDraw ? { increment: 1 } : undefined,
          },
        });

        // Append-only history (upsert-noop: concurrent duplicates collide
        // on UNIQUE(gameId, userId) and roll back instead of double-applying)
        const beforeModel = game.ratings[uId];
        await tx.ratingHistory.upsert({
          where: { gameId_userId: { gameId: game.id, userId: uId } },
          create: {
            userId: uId,
            gameId: game.id,
            mode: game.mode,
            ratingBefore: change.before,
            ratingAfter: change.after,
            delta: change.delta,
            rdBefore: beforeModel?.rd ?? 350,
            rdAfter: updated.rd,
            volBefore: beforeModel?.vol ?? 0.06,
            volAfter: updated.vol,
            algorithmVersion: RATING_ALGORITHM_VERSION,
          },
          update: {},
        });
      }
    });
  }
}
