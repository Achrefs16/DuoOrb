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
import { AiwinsService } from '../aiwins/aiwins.service.js';
import { Logger } from '@nestjs/common';

/**
 * Hard ceiling on how much round-trip time is refunded from a player's clock.
 *
 * A measured RTT on a bad connection can be seconds; refunding all of it would
 * turn a laggy player into an immortal one. 1200ms covers a poor-but-real
 * mobile connection while staying far below a single thinking block.
 */
const MAX_LATENCY_REFUND_MS = 1200;

/**
 * Seconds a player may sit on their turn without moving, while CONNECTED,
 * before they forfeit. Distinct from the disconnect grace: this punishes an
 * idle client (tab backgrounded, phone asleep), not an absent one, and the
 * two never share a timer or an indicator. The warning fires with the full
 * allowance (the countdown IS the warning, shown on that seat's card).
 */
export const AFK_TIMEOUT_MS = 45_000;

/**
 * Join quorum: how long a created game waits for every seat's first
 * `game:join` before treating no-shows as disconnected (standard 45s grace
 * from there). Covers slow clients without billing the opening turn to
 * whoever arrived first (see clockStarted).
 */
export const JOIN_QUORUM_MS = 90_000;

/** EWMA weight for the latency estimate. Heavily favours recent samples. */
const LATENCY_SMOOTHING = 0.3;

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
   * Per-seat smoothed round-trip latency, in ms, learned from the clock probe
   * (`game:ping`). The mover's own RTT is subtracted from what they are
   * charged, so their clock is not eaten by the network they did not choose.
   * Smoothed (EWMA) and clamped: one bad sample must not hand anyone a minute.
   */
  latencyMs: Record<string, number>;
  /**
   * Server time at which the disconnect grace window ENDS for a user. The
   * client renders its countdown from this, so a slow phone cannot show a
   * longer window than the server will actually honour.
   */
  disconnectGraceEndsAt: Record<string, number>;
  /**
   * Whether the countdown is running. False from creation until every seat
   * has sent its first `game:join` (join quorum): the opening turn must not
   * bill pairing + join latency to whoever arrived first. No flag, no AFK,
   * no charge while false — only the quorum timer runs.
   */
  clockStarted: boolean;
  /**
   * Seats that sent at least one `game:join`. Drives the join quorum; moved
   * by migrateUser like every other user-keyed seat state.
   */
  joinedUserIds: Set<string>;
  /** True once every seat joined (or for recovered games, immediately). */
  quorumReached: boolean;
  /** No-show timer, armed at creation, cleared at quorum or completion. */
  quorumTimeout?: NodeJS.Timeout;
  /**
   * One-shot flag timer for the CURRENT turn: fires exactly at the holder's
   * deadline instead of at the next 1s tick. The tick loop stays for
   * broadcast only. Rearmed on every turn transition, cleared on completion.
   */
  flagTimeout?: NodeJS.Timeout;
  /** Turn token: a flag callback whose token mismatches is stale. */
  flagToken: number;
  timerInterval?: NodeJS.Timeout;
  /** Retained so the clock loop can restart after a mid-game forfeit. */
  onClockTick?: (gameId: string, clock: ClockStateDto) => void;
  onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void;
  /**
   * Mid-table forfeit that does NOT end the game (AFK, or a disconnect in a
   * multiplayer table). Same shape the disconnect path already uses, so the
   * gateway persists and broadcasts one way for every non-terminal forfeit.
   */
  onForfeit?: (
    gameId: string,
    ended: GameEndedDto | null,
    finished?: { playerId: string; userId: string; place: number },
    lastMove?: RecordedAction
  ) => void;
  /**
   * Fired once when the join quorum times out, listing the seats that never
   * joined (already put on standard disconnect grace by then). The gateway
   * uses it to broadcast the grace countdown to the waiting seats.
   */
  onQuorumExpired?: (
    gameId: string,
    missing: { userId: string; playerId: string; gracePeriodSeconds: number; graceEndsAt: number }[]
  ) => void;
onAfkWarning?: (gameId: string, payload: { playerId: string; afkEndsAt: number; secondsRemaining: number }) => void;
  /**
   * Inactivity watchdog, keyed by seat. Never armed for a seat inside a
   * disconnect grace window — absence and idling are different states and
   * must not be able to end the same game twice.
   */
  afkTimers: Map<string, NodeJS.Timeout>;
  /**
   * Server time at which the seat on turn forfeits for inactivity, or null
   * when no watchdog applies. Emitted with the warning and repeated in every
   * sync, so a client that attaches mid-turn derives the same countdown.
   */
  afkEndsAt: number | null;
  /**
   * Inactivity allowance surviving a disconnect, in ms. When a seat drops
   * mid-turn, the running AFK watch is banked here instead of discarded; the
   * returnee resumes with the REMAINING time, not a fresh 45s. Reset on every
   * turn transition (a new turn earns a full allowance) and consumed on
   * re-arm. Without this, idling 44s then blipping the connection granted a
   * fresh 45s — and chained disconnects extended idling indefinitely.
   */
  afkCarryMs: number | null;
  disconnectedUsers: Record<string, { disconnectTime: number; timeoutId: NodeJS.Timeout }>;
  /**
   * Monotonic token per user, bumped on every arm AND every cancel. A grace
   * callback that was already queued when its timer was cleared compares
   * against this before acting, so a superseded timer can never delete the
   * live entry or forfeit a player who is back.
   */
  disconnectGenerations: Record<string, number>;
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
   * How much of a seat's own round trip to refund when charging their clock.
   *
   * Refunding the FULL measured RTT would hand back time the player genuinely
   * spent deciding, so this refunds a bounded fraction and never more than
   * the elapsed window. With no probe yet (first move of a game) it refunds
   * nothing: unknown latency must not become free time.
   */
  private latencyCompensationMs(game: ActiveOnlineGame, playerId: string): number {
    const rtt = game.latencyMs[playerId];
    if (rtt === undefined || rtt <= 0) return 0;
    return Math.min(rtt, MAX_LATENCY_REFUND_MS);
  }

  /**
   * (Re)starts the 1-second broadcast/tick loop for a game. The loop never
   * owns time itself — every tick derives remaining time from
   * clocksMs + turnStartTimestamp (deadline math), so stalls only delay
   * broadcasts and timeouts fire from real deadlines.
   *
   * The clock is never paused, including while a seat is away: a
   * disconnected player's time keeps running until they return or the grace
   * window forfeits them. Pausing used to freeze the table and credit the
   * window back on reconnect, which read as the clock restarting and gaining
   * seconds.
   */
  /** Housekeeping timers must never hold the process open on their own. */
  private unrefTimer(t: NodeJS.Timeout): void {
    if (typeof (t as unknown as { unref?: unknown }).unref === 'function') {
      (t as unknown as { unref: () => void }).unref();
    }
  }

  /**
   * Wall time spent on the current turn, never negative: Date.now() can step
   * back (NTP), and a negative elapsed used to read as a free turn through
   * every Math.max(0, …) below. Clamp once, here, for all clock math.
   */
  private elapsedMs(game: ActiveOnlineGame, now: number): number {
    return Math.max(0, now - game.turnStartTimestamp);
  }

  /**
   * THE clock math: ms left for the turn holder after their latency refund.
   * Tick flag, one-shot flag timer, on-move deadline, snapshot display, and
   * move charging ALL derive from this — one helper, no drift between what
   * is shown, what is charged, and what kills. (Previously the tick/snapshot
   * used raw elapsed while charging refunded it, so the display was
   * pessimistic by up to 1200ms and the tick could flag a player whose
   * refund would have saved them.)
   */
  private refundedRemainingMs(game: ActiveOnlineGame, now: number): number {
    const holder = game.state.players[game.state.currentPlayerIndex]?.id;
    if (holder === undefined) return 0;
    const billable = Math.max(
      0,
      this.elapsedMs(game, now) - this.latencyCompensationMs(game, holder)
    );
    return Math.max(0, game.clocksMs[holder] - billable);
  }

  /**
   * Flag-fall, shared by the tick, the one-shot flag timer, and the on-move
   * deadline check: the holder's clock is zeroed and the engine records the
   * TIMEOUT. Returns the broadcast payloads so callers stay thin.
   */
  private flagPlayer(
    game: ActiveOnlineGame,
    now: number
  ): { recorded: RecordedAction; ended: GameEndedDto } | null {
    if (game.state.status !== 'IN_PROGRESS') return null;
    const holder = game.state.players[game.state.currentPlayerIndex]?.id;
    if (!holder) return null;
    if (game.timerInterval) clearInterval(game.timerInterval);
    if (game.flagTimeout) clearTimeout(game.flagTimeout);
    game.clocksMs[holder] = 0;
    const timeoutRes = applyAction(game.state, { type: 'TIMEOUT' }, {
      timestamp: now,
      clockRemainingMs: 0,
    });
    if (!timeoutRes.success) return null;
    game.state = timeoutRes.state;
    this.ledgerMove(game, timeoutRes.state.lastMove!);
    const ended = this.finalizeGame(game, 'TIMEOUT');
    return { recorded: timeoutRes.state.lastMove!, ended };
  }

  /**
   * One-shot expiry for the current turn. Fires flagPlayer exactly at the
   * holder's deadline — a move arriving after the deadline but before the
   * next 1s tick can no longer dodge the flag, and a stalled event loop
   * delays expiry by the stall only, not stall + quantum. No-op for untimed
   * games (no enforcement) and pre-quorum (clock not running).
   */
  private armFlagTimer(game: ActiveOnlineGame): void {
    if (game.flagTimeout) clearTimeout(game.flagTimeout);
    game.flagTimeout = undefined;
    if (
      game.state.status !== 'IN_PROGRESS' ||
      !game.clockStarted ||
      game.timeControlMinutes <= 0
    ) {
      return;
    }
    const remaining = this.refundedRemainingMs(game, Date.now());
    const token = (game.flagToken ?? 0) + 1;
    game.flagToken = token;
    game.flagTimeout = setTimeout(() => {
      if (game.flagToken !== token) return; // turn moved on already
      if (game.state.status !== 'IN_PROGRESS' || !game.clockStarted) return;
      // Same precedence as the tick: grace owns the table while anyone is
      // away. The return path re-arms (see cancelDisconnectGrace).
      if (Object.keys(game.disconnectedUsers).length > 0) return;
      const flagged = this.flagPlayer(game, Date.now());
      if (flagged && game.onTimeout) {
        game.onTimeout(game.id, flagged.ended, flagged.recorded);
      }
    }, Math.max(0, remaining));
    this.unrefTimer(game.flagTimeout);
  }

  private startClockLoop(
    game: ActiveOnlineGame,
    onClockTick?: (gameId: string, clock: ClockStateDto) => void,
    onTimeout?: (gameId: string, ended: GameEndedDto, lastMove: RecordedAction) => void,
  ): void {
    if (game.timeControlMinutes <= 0) return;
    if (game.timerInterval) clearInterval(game.timerInterval);
    game.timerInterval = setInterval(() => {
      if (game.state.status !== 'IN_PROGRESS') {
        if (game.timerInterval) clearInterval(game.timerInterval);
        return;
      }

      // Safety guard only: the clock starts with the match (see createGame),
      // so a live game always has a running turn here.
      if (!game.clockStarted) return;

      const now = Date.now();
      const currentRemaining = this.refundedRemainingMs(game, now);

      // Absence owns the table: while any seat is away, the grace timer —
      // not the clock — decides outcomes, so a low clock can never finalize
      // TIMEOUT underneath a pending DISCONNECT (reason precedence, M19).
      // Broadcasts continue; only the flag is suspended.
      const anyoneAway = Object.keys(game.disconnectedUsers).length > 0;
      if (currentRemaining <= 0 && !anyoneAway) {
        // Timeout reached (always the active side to move — finished
        // players never hold the clock, so they can never time out).
        // The one-shot flag timer normally fires first; this is the belt
        // to those braces (timer lost, untimed drift, clock skew).
        const flagged = this.flagPlayer(game, now);
        if (flagged && onTimeout) {
          onTimeout(game.id, flagged.ended, flagged.recorded);
        }
        return;
      }

      if (onClockTick) {
        const tickRemainingMs = this.clockSnapshot(game, now);
        onClockTick(game.id, {
          activePlayerIndex: game.state.currentPlayerIndex,
          remainingMs: tickRemainingMs,
          serverTimestamp: now,
          incrementSeconds: game.incrementSeconds,
        });
      }
    }, 1000);
  }

  constructor(
    private readonly prisma?: PrismaService,
    /**
     * Online achievement engine. Optional so unit tests keep constructing
     * bare; absent in tests, present in production (wired by the gateway).
     * Evaluation never touches completion: it runs after the commit and
     * failures are swallowed with a log line.
     */
    private readonly aiwins?: Pick<AiwinsService, 'evaluateOnlineGame'>,
  ) {
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
    onAfkWarning?: (gameId: string, payload: { playerId: string; afkEndsAt: number; secondsRemaining: number }) => void;
    onForfeit?: (
      gameId: string,
      ended: GameEndedDto | null,
      finished?: { playerId: string; userId: string; place: number },
      lastMove?: RecordedAction
    ) => void;
    onQuorumExpired?: (
      gameId: string,
      missing: { userId: string; playerId: string; gracePeriodSeconds: number; graceEndsAt: number }[]
    ) => void;
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
      // The clock does NOT start here. It starts at the join quorum — the
      // first game:join from every seat — so the opener never pays pairing +
      // join latency, and a seat that never joins is a no-show (quorum
      // timeout → standard grace), never a free AFK win against the player
      // who showed up. Pre-quorum turns are playable but unbilled.
      turnStartTimestamp: Date.now(),
      clockStarted: false,
      joinedUserIds: new Set(),
      quorumReached: false,
      flagToken: 0,
      latencyMs: {},
      disconnectGraceEndsAt: {},
    onClockTick: params.onClockTick,
      onTimeout: params.onTimeout,
      onAfkWarning: params.onAfkWarning,
      onForfeit: params.onForfeit,
      onQuorumExpired: params.onQuorumExpired,
      afkTimers: new Map(),
      afkEndsAt: null,
      afkCarryMs: null,
      disconnectedUsers: {},
      disconnectGenerations: {},
      rematchOffers: new Set(),
      isRanked: params.isRanked,
      timeControlMinutes: params.timeControlMinutes,
      wallsEach: params.wallsEach ?? startingWallsForMode(params.mode),
      pendingMoves: [],
      seenActions: new Map(),
      leftUserIds: new Set(),
    };

    this.games.set(params.gameId, activeGame);

    // No clock loop, no AFK watchdog yet — both start at the join quorum.
    // Only the no-show timer runs: seats that never join are treated as
    // disconnected (standard grace from there), never as free wins.
    activeGame.quorumTimeout = setTimeout(() => {
      this.enforceJoinQuorum(params.gameId);
    }, JOIN_QUORUM_MS);
    this.unrefTimer(activeGame.quorumTimeout);

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
   * Records a seat's first `game:join`. When every seat has joined, the join
   * quorum is reached and the clock starts — from NOW, with full time, so
   * pairing + join latency is never billed to anyone. Idempotent; safe to
   * call on every join, including rejoins. Returns true when the quorum is
   * satisfied after this call.
   */
  public markSeatJoined(gameId: string, userId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    if (game.userPlayerIds[userId] === undefined) return false;
    game.joinedUserIds.add(userId);
    if (!game.quorumReached && game.state.status === 'IN_PROGRESS') {
      const seated = Object.keys(game.userPlayerIds);
      if (seated.every((u) => game.joinedUserIds.has(u))) {
        this.reachQuorum(game);
      }
    }
    return game.quorumReached;
  }

  private reachQuorum(game: ActiveOnlineGame): void {
    game.quorumReached = true;
    if (game.quorumTimeout) clearTimeout(game.quorumTimeout);
    game.quorumTimeout = undefined;
    game.clockStarted = true;
    game.turnStartTimestamp = Date.now();
    this.startClockLoop(game, game.onClockTick, game.onTimeout);
    // The opening turn is a turn like any other: whoever holds it gets the
    // same 45s allowance (and the same warning) as every later one. Without
    // this a player who never moves at all is never warned and never
    // forfeited.
    this.armAfkTimer(game);
    this.armFlagTimer(game);
  }

  /**
   * No-show enforcement: seats that never sent `game:join` within
   * JOIN_QUORUM_MS are treated exactly like disconnects — standard 45s grace
   * from here, then forfeit. The waiting seats learn about it through
   * onQuorumExpired (grace countdown broadcast), not silence. Never fires
   * for completed games or after the quorum was reached.
   */
  public enforceJoinQuorum(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.quorumReached || game.state.status !== 'IN_PROGRESS') return;
    const missing = Object.keys(game.userPlayerIds).filter(
      (u) => !game.joinedUserIds.has(u)
    );
    if (missing.length === 0) {
      this.reachQuorum(game);
      return;
    }
    const armed: { userId: string; playerId: string; gracePeriodSeconds: number; graceEndsAt: number }[] = [];
    for (const userId of missing) {
      const res = this.handleDisconnect(game.id, userId, (ended, finished, lastMove) =>
        game.onForfeit?.(game.id, ended, finished, lastMove)
      );
      if (res) {
        armed.push({
          userId,
          playerId: res.playerId,
          gracePeriodSeconds: res.gracePeriodSeconds,
          graceEndsAt: res.graceEndsAt,
        });
      }
    }
    if (armed.length > 0) {
      game.onQuorumExpired?.(game.id, armed);
    }
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
        // ...and its quorum is already satisfied for the same reason: every
        // seat was live pre-crash. Re-arming a join wait here would forfeit
        // the whole table 90s after every deploy.
        joinedUserIds: new Set(Object.values(userPlayerIds)),
        quorumReached: true,
        flagToken: 0,
        latencyMs: {},
        disconnectGraceEndsAt: {},
        afkTimers: new Map(),
        afkEndsAt: null,
        afkCarryMs: null,
        disconnectedUsers: {},
      disconnectGenerations: {},
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
    onAfkWarning?: (gameId: string, payload: { playerId: string; afkEndsAt: number; secondsRemaining: number }) => void;
    onForfeit?: (
      gameId: string,
      ended: GameEndedDto | null,
      finished?: { playerId: string; userId: string; place: number },
      lastMove?: RecordedAction
    ) => void;
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
        game.onAfkWarning = hooks.onAfkWarning;
        game.onForfeit = hooks.onForfeit;
        this.startClockLoop(game, hooks.onClockTick, hooks.onTimeout);
        // Whoever holds the turn gets a fresh allowance: the pre-crash
        // watchdog died with the process, and without this a recovered game
        // whose player never moves is never warned and never forfeited.
        if (game.state.status === 'IN_PROGRESS') {
          this.armAfkTimer(game);
          this.armFlagTimer(game);
        }
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
      if (game.joinedUserIds.has(oldUserId)) {
        game.joinedUserIds.delete(oldUserId);
        game.joinedUserIds.add(newUserId);
        changed = true;
      }
      if (game.ratings[oldUserId] !== undefined) {
        game.ratings[newUserId] = game.ratings[oldUserId];
        delete game.ratings[oldUserId];
        changed = true;
      }
      if (game.disconnectedUsers[oldUserId] !== undefined) {
        // Identity change mid-grace (guest→account sign-in): the armed timer
        // closes over the OLD id, so without a re-arm its guards fail and the
        // forfeit never fires — infinite grace, and a forfeit dodge via
        // sign-in. Move the entry and re-arm the SAME expiry under the new id
        // with the REMAINING window: the returnee keeps exactly the time they
        // had, no more, no less. `latencyMs` needs no move: it is keyed by
        // seat (playerId), which does not change.
        const oldEntry = game.disconnectedUsers[oldUserId];
        const oldDeadline = game.disconnectGraceEndsAt[oldUserId];
        clearTimeout(oldEntry.timeoutId);
        delete game.disconnectedUsers[oldUserId];
        delete game.disconnectGraceEndsAt[oldUserId];
        delete game.disconnectGenerations[oldUserId];
        if (oldDeadline !== undefined) {
          const remaining = Math.max(0, oldDeadline - Date.now());
          const generation = (game.disconnectGenerations[newUserId] ?? 0) + 1;
          game.disconnectGenerations[newUserId] = generation;
          game.disconnectGraceEndsAt[newUserId] = Date.now() + remaining;
          const forfeit = game.onForfeit;
          const timeoutId = setTimeout(() => {
            this.fireGraceExpiry(game.id, newUserId, generation, timeoutId, (ended, finished, lastMove) =>
              forfeit?.(game.id, ended, finished, lastMove));
          }, remaining);
          this.unrefTimer(timeoutId);
          game.disconnectedUsers[newUserId] = {
            disconnectTime: Date.now(),
            timeoutId,
          };
        }
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
  /**
   * Records a client's measured round-trip time for a seat.
   *
   * The client times its own `game:ping` request/ack and reports the result,
   * because only the client knows when the reply actually landed. Smoothed
   * into an EWMA and clamped, so one spike cannot mask a chronically bad
   * connection (or the reverse).
   *
   * Ignores implausible samples outright rather than smoothing them in.
   */
  public recordLatency(gameId: string, userId: string, rttMs: number): void {
    const game = this.games.get(gameId);
    const playerId = game?.userPlayerIds[userId];
    if (!game || !playerId) return;
    if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 5000) return;
    const previous = game.latencyMs[playerId];
    game.latencyMs[playerId] =
      previous === undefined ? rttMs : previous + (rttMs - previous) * LATENCY_SMOOTHING;
  }

  /**
   * Authoritative clock map for a seat set, with the ACTIVE seat's elapsed
   * time already applied.
   *
   * The raw `clocksMs` only changes when a move lands, so handing it out
   * unadjusted hands out a clock that is too generous by however long the
   * current turn has been running — on every sync and every reconnect. This
   * derives exactly like the 1 Hz tick does, which is what keeps the two
   * consistent: a reconnect can never hand the active player time back, and
   * the number cannot jump upward.
   *
   * The waiting seats are untouched: their clocks are not running.
   */
  public clockSnapshot(game: ActiveOnlineGame, now = Date.now()): Record<string, number> {
    const out = { ...game.clocksMs };
    // Untimed games have no enforcement: the ledger baseline is shown
    // static, never counted down (explicit policy — AFK remains the stall
    // guard, the clock display simply does not run).
    if (game.timeControlMinutes <= 0) return out;
    const activePlayerId = game.state.players[game.state.currentPlayerIndex]?.id;
    if (activePlayerId !== undefined && game.clockStarted) {
      // Same refunded math as flag and charge: the display can never show
      // less than the mover would actually be left with.
      out[activePlayerId] = this.refundedRemainingMs(game, now);
    }
    return out;
  }

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

    // Flag check on move: a move arriving after the deadline but before the
    // next 1s tick (or with a lost one-shot timer) is a TIMEOUT loss, not an
    // accepted move. Without this, lost-on-time positions were winnable
    // inside the tick gap — including with increment attached. Untimed games
    // and pre-quorum turns have no enforcement, so they skip the check.
    if (
      action.type !== 'RESIGN' &&
      game.timeControlMinutes > 0 &&
      game.clockStarted &&
      this.refundedRemainingMs(game, now) <= 0
    ) {
      const flagged = this.flagPlayer(game, now);
      if (flagged) {
        if (opts?.clientActionId) {
          game.seenActions.set(opts.clientActionId, { recorded: flagged.recorded, ended: flagged.ended });
        }
        return { success: true, recorded: flagged.recorded, ended: flagged.ended };
      }
      // Engine refused the flag (already finished concurrently): the move
      // cannot be accepted on a non-live game either.
      return { success: false, error: { code: 'GAME_NOT_IN_PROGRESS', message: 'Game has already ended.' } };
    }

    // Clock charge.
    //
    // The clock is only ever charged to the seat that actually holds the
    // turn: an off-turn resign moves nobody's clock at all, and an on-turn
    // move/resign charges the holder minus their latency refund. (An older
    // comment claimed the actor pays; the code never did — off-turn resigns
    // used to deduct from the innocent opponent, and that was the bug.)
    //
    // Two corrections below, both of which used to be missing:
    //
    // 1. LATENCY. The mover's own round trip is subtracted, so a bad network
    //    costs them thinking time only. Without this the charge was
    //    `downlink + thinking + uplink`.
    // 2. MONOTONIC elapsed (see elapsedMs): a clock step back cannot grant
    //    a free turn.
    //
    // The clock runs from the join quorum (see clockStarted) and is never
    // paused — not even while a seat is away. A disconnected player's time
    // keeps running until they return or the grace window forfeits them.
    const clockOwner = expectedPlayerId;
    const isClockOwnerActor = senderPlayerId === clockOwner || senderPlayerId === undefined;

    // Pre-quorum turns are playable but unbilled: the ledger only moves once
    // the quorum starts the clock, so pairing latency never sticks.
    if (game.timeControlMinutes > 0 && game.clockStarted) {
      // Only the seat on turn burns clock. A resignation from off-turn (or a
      // forfeit attributed to an absent player) costs the actor nothing.
      // Charging IS the unified deadline math: the ledger lands exactly where
      // the display and the flag already agree it is.
      if (isClockOwnerActor) {
        game.clocksMs[clockOwner] = this.refundedRemainingMs(game, now);
      }

      // Add Fischer increment after move completion (if not timeout or resign)
      if (action.type !== 'RESIGN' && action.type !== 'TIMEOUT' && game.incrementSeconds > 0) {
        game.clocksMs[clockOwner] += game.incrementSeconds * 1000;
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

    // The turn passed: the watchdog for it is done, and whoever is now on
    // turn gets their own (with a fresh warning, even if the seat is the
    // same one that just reconnected). The flag timer moves with the turn
    // too, so expiry always tracks the current holder's live deadline.
    // A new turn earns a full allowance: any banked remainder dies here.
    this.clearAfkTimers(game);
    game.afkCarryMs = null;
    if (game.state.status === 'IN_PROGRESS' && game.clockStarted) {
      this.armAfkTimer(game);
    }
    if (game.state.status === 'IN_PROGRESS') {
      this.armFlagTimer(game);
    }

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
   * Explicit rematch decline. Removes the decliner from the offer set so a
   * later offer starts clean; the gateway notifies the waiting seats so the
   * offeror stops waiting out the 30s TTL. No-ops on unknown/finished games
   * and for non-seats.
   */
  public declineRematch(gameId: string, userId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    if (game.state.status !== 'COMPLETED') return false;
    if (game.userPlayerIds[userId] === undefined) return false;
    game.rematchOffers.delete(userId);
    return true;
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
      // Every seat accepted. Rotate seat order by one so first-move advantage
      // moves around the table. For 1v1 this is exactly the old p1/p2 swap;
      // for 3-4P tables it is what keeps every player seated. The previous
      // code hardcoded p1/p2 here, so players 3 and 4 were silently dropped
      // from the rematch and their join was rejected as "not seated" — the
      // "different account" dead-end on the client.
      const seatIds = game.state.players.map((p) => p.id);
      const rotatedIds = [...seatIds.slice(1), seatIds[0]];
      const rotatedUsers = rotatedIds.map((playerId) => {
        const userId = game.playerUserIds[playerId];
        const seat = game.state.players.find((p) => p.id === playerId);
        return {
          userId,
          // Carry the live name (including any mid-game rename), not a
          // generated placeholder: the old code froze every rematch as
          // "Player ab12" until a later re-sync happened to fix it.
          displayName: seat?.displayName ?? `Player ${userId.slice(0, 4)}`,
          rating: game.ratings[userId],
        };
      });

      const newGameId = `game-rematch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      return {
        offered: true,
        newGameParams: {
          gameId: newGameId,
          mode: game.mode,
          users: rotatedUsers,
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
  ): { gracePeriodSeconds: number; playerId: string; graceEndsAt: number } | null {
    const game = this.games.get(gameId);
    if (!game || game.state.status !== 'IN_PROGRESS') return null;

    const playerId = game.userPlayerIds[userId];
    if (!playerId) return null;

    const seat = game.state.players.find((p) => p.id === playerId);
    if (!seat || seat.status === 'FINISHED') return null;

    // Reconnect grace: 45 seconds, identical for ranked and casual. This is
    // the SERVER's window — the client only renders a countdown derived from
    // `graceEndsAt`, so a slow or sleeping phone cannot extend it. It is a
    // different mechanism from the AFK limit (see AFK_TIMEOUT_MS), and the
    // two never share a timer.
    const graceSeconds = 45;
    const armedAt = Date.now();
    const graceEndsAt = armedAt + graceSeconds * 1000;

    // A second disconnect before the first grace expires must REPLACE the
    // old timer, not stack on top of it: an orphaned timer would fire while
    // the player is already back and forfeit a game they are playing. The
    // generation token is the belt to that braces — a callback that has
    // already been queued when the timer is cleared still runs, and it must
    // recognize that its entry is no longer the live one. Runs BEFORE the
    // deadline is recorded, because cancelling clears it.
    this.cancelDisconnectGrace(gameId, userId);
    game.disconnectGraceEndsAt[userId] = graceEndsAt;

    // Bank the running inactivity watch before absence kills it (see
    // afkCarryMs): the returnee resumes the remainder, not a fresh 45s.
    // Only banked when a watch was actually running — chained disconnects
    // keep the FIRST remainder instead of resetting it.
    if (game.afkEndsAt !== null) {
      game.afkCarryMs = Math.max(0, game.afkEndsAt - Date.now());
    }

    // The clock keeps running while the seat is away: it is only the grace
    // window that decides the outcome, and a frozen-then-credited clock read
    // as time being added back on reconnect.
    // Every AFK watchdog dies here too — absence owns the whole table while
    // it lasts (see armAfkTimer), and two timers racing to end the same game
    // is how double-processed results happen.
    this.clearAfkTimers(game);
    const generation = (game.disconnectGenerations[userId] ?? 0) + 1;
    game.disconnectGenerations[userId] = generation;

    const timeoutId = setTimeout(() => {
      this.fireGraceExpiry(gameId, userId, generation, timeoutId, onForfeit);
    }, graceSeconds * 1000);
    this.unrefTimer(timeoutId);

    game.disconnectedUsers[userId] = {
      disconnectTime: Date.now(),
      timeoutId,
    };

    return { gracePeriodSeconds: graceSeconds, playerId, graceEndsAt };
  }

  /**
   * Grace-expiry body, shared by the armed timer and by `migrateUser`'s
   * re-arm. Extracted so an identity change mid-grace cannot orphan the
   * forfeit: the migration re-arms this same logic under the new id with
   * the remaining window instead of retiring the token and granting
   * infinite grace.
   */
  private fireGraceExpiry(
    gameId: string,
    userId: string,
    generation: number,
    timeoutId: NodeJS.Timeout,
    onForfeit: (ended: GameEndedDto | null, finished?: { playerId: string; userId: string; place: number }, lastMove?: RecordedAction) => void
  ): void {
    const game = this.games.get(gameId);
    if (!game) return;
    // Superseded by a newer disconnect (or a reconnect): not ours to run.
    if (game.disconnectGenerations[userId] !== generation) return;
    if (game.disconnectedUsers[userId]?.timeoutId !== timeoutId) return;
    delete game.disconnectedUsers[userId];
    delete game.disconnectGenerations[userId];
    delete game.disconnectGraceEndsAt[userId];
    const g = this.games.get(gameId);
    if (!g || g.state.status !== 'IN_PROGRESS') return;
    const playerId = g.userPlayerIds[userId];
    const seatNow = g.state.players.find((p) => p.id === playerId);
    if (!playerId || !seatNow || seatNow.status === 'FINISHED') return;
    // Disconnect forfeit = TIMEOUT by the absent player (works off-turn).
    const res = applyAction(g.state, { type: 'TIMEOUT' }, {
      timestamp: Date.now(),
      clockRemainingMs: 0,
      actorId: playerId,
    });
    if (!res.success) return;
    // Grace debit FIRST, against the seat that actually held the turn through
    // the window: the clock visibly ran the whole 45s, so the holder pays for
    // it before the forfeit passes the turn on. Debiting after the state
    // change would bill the wrong seat (whoever inherits the turn). An
    // off-turn disconnect therefore gifts the thinker nothing, and an
    // on-turn leaver's clock runs to forfeit instead of freezing at
    // disconnect.
    {
      const holderBefore = g.state.players[g.state.currentPlayerIndex]?.id;
      if (holderBefore !== undefined && g.timeControlMinutes > 0) {
        const debit = Math.max(
          0,
          this.elapsedMs(g, Date.now()) - this.latencyCompensationMs(g, holderBefore)
        );
        g.clocksMs[holderBefore] = Math.max(0, g.clocksMs[holderBefore] - debit);
      }
    }
    g.state = res.state;
    // The grace expired: the clock was never paused, so there is nothing
    // to credit back — the remaining seats simply continue on real time.
    g.clockStarted = true;
    g.turnStartTimestamp = Date.now();
    this.ledgerMove(g, res.state.lastMove!);
    if (res.state.status !== 'COMPLETED') {
      if (g.timerInterval) { clearInterval(g.timerInterval); }
      this.startClockLoop(g, g.onClockTick, g.onTimeout);
      g.afkCarryMs = null; // forfeit advanced the turn: fresh allowance
      this.armAfkTimer(g);
      this.armFlagTimer(g);
      const last = res.state.placements[res.state.placements.length - 1];
      onForfeit(null, { playerId: last.playerId, userId: g.playerUserIds[last.playerId], place: last.place }, res.state.lastMove!);
      return;
    }
    if (g.timerInterval) clearInterval(g.timerInterval);
    const ended = this.finalizeGame(g, 'DISCONNECT');
    onForfeit(ended, undefined, res.state.lastMove!);
  }

  /**
   * Cancels a pending disconnect-grace timer without producing a sync.
   *
   * Split out of handleReconnect because the reconnect path needs the timer
   * dead IMMEDIATELY — before it awaits the client's unconfirmed moves —
   * while the sync it answers with must still reflect those moves. Doing
   * both in one call either races the grace timer or sends stale state.
   *
   * @returns true when a live timer was cancelled.
   */
  public cancelDisconnectGrace(gameId: string, userId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;
    const entry = game.disconnectedUsers[userId];
    if (entry) {
      clearTimeout(entry.timeoutId);
      delete game.disconnectedUsers[userId];
    }
    delete game.disconnectGraceEndsAt[userId];
    // Monotonic tokens: bump, never delete. Deleting reset the next arm to
    // 1 and let a superseded callback's generation check pass — the timeoutId
    // check below was the only thing saving it (M3).
    game.disconnectGenerations[userId] = (game.disconnectGenerations[userId] ?? 0) + 1;
    // A cancelled LIVE timer means its owner is back: whoever holds the turn
    // gets their inactivity watchdog (re)armed — but only once nobody is
    // away any more. A returnee who is back on turn and then idles must
    // still be warned and forfeited; without this their timer died with the
    // disconnect and nothing replaces it until the next move. (No entry, as
    // in the pre-arm cancel inside handleDisconnect, means nothing to
    // replace — arming there would only emit a spurious warning.)
    const stillAway = Object.keys(game.disconnectedUsers).length > 0;
    if (!!entry && !stillAway) {
      // Returnee resumes the banked remainder when there is one (idling
      // through someone's absence earns no fresh allowance); otherwise a
      // full watch, as before. The flag timer resumes alongside: it stood
      // down for the whole absence (M19) and the deadline may already have
      // passed — in which case it fires honestly on re-arm.
      if (game.afkCarryMs !== null) {
        const carry = game.afkCarryMs;
        game.afkCarryMs = null;
        this.armAfkTimer(game, carry);
      } else {
        this.armAfkTimer(game);
      }
      this.armFlagTimer(game);
    }
    return !!entry;
  }

  /**
   * Arms (or re-arms) the inactivity watchdog for whoever holds the turn.
   *
   * This is NOT the disconnect grace: the seat here is CONNECTED and simply
   * not moving — a backgrounded tab, a phone that slept. It carries its own
   * timer, its own end reason (`AFK`) and its own client indicator, and it is
   * cancelled outright if that seat drops (absence is then the grace timer's
   * job, and two timers ending the same game is how results get processed
   * twice).
   *
   * The warning fires WITH the full 45s allowance, not near its end: the
   * countdown on the card IS the warning, and a client that attaches
   * mid-turn derives the same countdown from the sync's `afk` deadline.
   *
   * Never armed while any seat is away: absence already owns the outcome
   * through the grace timer, and a connected player thinking through their
   * opponent's disconnect must not be forfeited for idling on top of it.
   *
   * @param allowanceMs inactivity budget for this arming. Fresh turns pass
   * the full 45s; grace returns pass the banked remainder (see afkCarryMs).
   * Zero or negative means the deadline already passed while away — the
   * timer fires on its next tick and forfeits honestly.
   */
  private armAfkTimer(game: ActiveOnlineGame, allowanceMs: number = AFK_TIMEOUT_MS): void {
    this.clearAfkTimers(game);
    if (game.state.status !== 'IN_PROGRESS' || !game.clockStarted) return;
    if (Object.keys(game.disconnectedUsers).length > 0) return;
    const playerId = game.state.players[game.state.currentPlayerIndex]?.id;
    if (!playerId) return;

    const afkEndsAt = Date.now() + allowanceMs;
    game.afkEndsAt = afkEndsAt;
    game.onAfkWarning?.(game.id, {
      playerId,
      afkEndsAt,
      secondsRemaining: Math.max(0, Math.ceil(allowanceMs / 1000)),
    });

    const timeoutId = setTimeout(() => {
      if (game.afkTimers.get(playerId) !== timeoutId) return;
      game.afkTimers.delete(playerId);
      if (game.state.status !== 'IN_PROGRESS') return;
      const seat = game.state.players.find((p) => p.id === playerId);
      if (!seat || seat.status === 'FINISHED') return;
      if (game.disconnectedUsers[game.playerUserIds[playerId]]) return; // absence, not idling

      const res = applyAction(game.state, { type: 'TIMEOUT' }, {
        timestamp: Date.now(),
        clockRemainingMs: 0,
        actorId: playerId,
      });
      if (!res.success) return;
      game.state = res.state;
      game.turnStartTimestamp = Date.now();
      this.clearAfkTimers(game);
      this.ledgerMove(game, res.state.lastMove!);
      if (game.timerInterval) clearInterval(game.timerInterval);

      if (res.state.status === 'COMPLETED') {
        const ended = this.finalizeGame(game, 'AFK');
        if (game.onTimeout) game.onTimeout(game.id, ended, res.state.lastMove!);
        return;
      }
      // Mid-table forfeit: the match continues for everyone else, exactly as
      // a disconnect forfeit does. Same callback, so the gateway persists and
      // broadcasts through one code path. Whoever is now on turn gets a fresh
      // watchdog — the table stays watched no matter how quiet it gets.
      this.startClockLoop(game, game.onClockTick, game.onTimeout);
      game.afkCarryMs = null; // forfeit advanced the turn: fresh allowance
      this.armAfkTimer(game);
      this.armFlagTimer(game);
      const last = res.state.placements[res.state.placements.length - 1];
      if (game.onForfeit && last) {
        game.onForfeit(
          game.id,
          null,
          { playerId: last.playerId, userId: game.playerUserIds[last.playerId], place: last.place },
          res.state.lastMove!
        );
      }
    }, Math.max(0, allowanceMs));
    if (typeof (timeoutId as unknown as { unref?: unknown }).unref === 'function') {
      (timeoutId as unknown as { unref: () => void }).unref();
    }
    game.afkTimers.set(playerId, timeoutId);
  }

  private clearAfkTimers(game: ActiveOnlineGame): void {
    for (const timer of game.afkTimers.values()) clearTimeout(timer);
    game.afkTimers.clear();
    game.afkEndsAt = null;
  }

  /**
   * Handles player reconnect, cancels grace timer, and returns sync state.
   */
  public handleReconnect(gameId: string, userId: string): GameSyncDto | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    this.cancelDisconnectGrace(gameId, userId);

    return this.getSyncState(gameId, 0, userId);
  }

  /**
   * Resynchronizes a player on reconnect with authoritative state and missing moves.
   *
   * `forUserId` is the id the SERVER resolved from the verified token. When
   * given, the response carries that player's seat in `you`, so the client
   * never has to guess which seat is its own.
   */
  public getSyncState(
    gameId: string,
    lastSequence = 0,
    forUserId?: string
  ): GameSyncDto | null {
    const game = this.games.get(gameId);
    if (!game) return null;

    const missing = game.state.history.filter((m) => m.sequence > lastSequence);
    const now = Date.now();
    const clockDto: ClockStateDto = {
      activePlayerIndex: game.state.currentPlayerIndex,
      // Derived, not raw: `clocksMs` is only written when a move lands, so
      // returning it unchanged hands the active player back every second the
      // turn has been running. A sync (and every reconnect goes through one)
      // therefore used to give away time and make the clock jump upward.
      // clockSnapshot applies exactly what the 1 Hz tick applies.
      remainingMs: this.clockSnapshot(game, now),
      serverTimestamp: now,
      incrementSeconds: game.incrementSeconds,
    };

    return {
      state: game.state,
      clock: clockDto,
      missingActions: missing,
      playerUserIds: game.playerUserIds,
      you: forUserId ? game.userPlayerIds[forUserId] ?? null : undefined,
      // Current turn's inactivity deadline, when one applies: a client that
      // attaches (or re-attaches) mid-turn missed the one-shot warning, so
      // it derives the same card countdown from this instead.
      afk:
        game.state.status === 'IN_PROGRESS' && game.afkEndsAt !== null
          ? {
              playerId: game.state.players[game.state.currentPlayerIndex]?.id ?? '',
              afkEndsAt: game.afkEndsAt,
            }
          : null,
      // Every seat currently inside a grace window (ALL seats, including the
      // requester's own): a re-attaching client missed the one-shot
      // broadcast and would otherwise show no countdown — least of all for
      // the deadline it is itself racing.
      grace: Object.entries(game.disconnectGraceEndsAt)
        .filter(([userId]) => game.userPlayerIds[userId] !== undefined)
        .map(([userId, graceEndsAt]) => ({
          userId,
          playerId: game.userPlayerIds[userId],
          graceEndsAt,
        })),
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

    // Terminal teardown: no timer may outlive the game. The tick loop is
    // cleared by callers; the flag, quorum, and AFK timers die here so a
    // finished game can never flag, forfeit, or bill again. Pending grace
    // timers die too: a move/timeout/AFK that ends the game retires every
    // absence with it (reconnects only cancel on the live path).
    if (game.timerInterval) clearInterval(game.timerInterval);
    if (game.flagTimeout) clearTimeout(game.flagTimeout);
    game.flagTimeout = undefined;
    if (game.quorumTimeout) clearTimeout(game.quorumTimeout);
    game.quorumTimeout = undefined;
    for (const away of Object.values(game.disconnectedUsers)) {
      clearTimeout(away.timeoutId);
    }
    game.disconnectedUsers = {};
    game.disconnectGraceEndsAt = {};
    game.disconnectGenerations = {};
    this.clearAfkTimers(game);

    // Schedule in-memory TTL cleanup after 15 minutes
    const ttl = setTimeout(() => {
      this.games.delete(game.id);
    }, 15 * 60 * 1000);
    this.unrefTimer(ttl);

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

        // Upsert the single universal rating row. An existing row moves by the
        // computed DELTA on top of what the ledger actually holds, never by an
        // absolute value derived from the game's seed — a stale seed then costs
        // accuracy instead of erasing rating. With a fresh seed (every creation
        // path re-reads it) the two are identical by construction.
        const stored = await tx.rating.findUnique({
          where: { userId: uId },
          select: { rating: true },
        });
        if (stored && Math.abs(stored.rating - change.before) > 1) {
          this.logger.warn(
            `Rating seed drift ${game.id}/${uId.slice(0, 6)}: seeded ${change.before}, ledger ${stored.rating}`
          );
        }
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
            rating: { increment: change.delta },
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

    // Online achievements, after the commit: the rating row and the game
    // row above are fresh, so the engine reads settled ledger state.
    // ratingChanges is empty for unranked games — nothing to evaluate.
    // Never throws into completion; a badge must not break a game ending.
    const rankedUserIds = Object.keys(ratingChanges);
    if (this.aiwins && rankedUserIds.length > 0) {
      for (const uId of rankedUserIds) {
        try {
          await this.aiwins.evaluateOnlineGame(uId);
        } catch (e) {
          this.logger.warn(`Achievement evaluation failed ${game.id}/${uId.slice(0, 6)}: ${(e as Error)?.message ?? e}`);
        }
      }
    }
  }
}
