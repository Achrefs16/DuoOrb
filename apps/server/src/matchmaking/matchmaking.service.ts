import { GameMode, playerCountForMode } from '@duoorb/game-core';

export interface MatchmakingRequest {
  userId: string;
  displayName: string;
  rating: number;
  mode: GameMode;
  timeControlMinutes: number;
  incrementSeconds?: number;
  wallsEach?: number;
  joinedAt: number;
  socketId: string;
}

export interface MatchmakingMatch {
  /** All seats in ranked order. 2P has two; Center/Race 3P/4P have 3/4. */
  players: MatchmakingRequest[];
  /** Legacy pair access for existing callers/tests. */
  player1: MatchmakingRequest;
  player2: MatchmakingRequest;
  mode: GameMode;
  timeControlMinutes: number;
  incrementSeconds: number;
  wallsEach: number;
}

export class MatchmakingService {
  private queue: MatchmakingRequest[] = [];
  private readonly INITIAL_WINDOW = 50;
  private readonly EXPANSION_RATE_PER_SEC = 20;

  public addToQueue(req: MatchmakingRequest): void {
    // Remove if already in queue
    this.queue = this.queue.filter((q) => q.userId !== req.userId);
    this.queue.push(req);
  }

  public removeFromQueue(userId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter((q) => q.userId !== userId);
    return this.queue.length < initialLength;
  }

  /**
   * Reconnects drop the socket but keep the user id: point the queued
   * entry at the fresh socket so matches never dial a dead line.
   */
  public updateSocket(userId: string, socketId: string): void {
    const entry = this.queue.find((q) => q.userId === userId);
    if (entry) entry.socketId = socketId;
  }

  /**
   * Guest signed in: rekey their queue entry to the account id so a
   * search started pre-sign-in still seats them correctly.
   */
  public migrateUser(oldUserId: string, newUserId: string): void {
    if (oldUserId === newUserId) return;
    const entry = this.queue.find((q) => q.userId === oldUserId);
    if (entry) entry.userId = newUserId;
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Evaluates queue and forms ranked groups. A group only contains players
   * with the same mode, time control, increment, and wall configuration.
   * 2P forms pairs; Center/Race 3P/4P wait for the full table.
   */
  public findMatches(): MatchmakingMatch[] {
    const matchedPairs: MatchmakingMatch[] = [];
    const now = Date.now();
    const matchedUserIds = new Set<string>();

    for (let i = 0; i < this.queue.length; i++) {
      const anchor = this.queue[i];
      if (matchedUserIds.has(anchor.userId)) continue;

      const required = playerCountForMode(anchor.mode);
      const waitSec = (now - anchor.joinedAt) / 1000;
      const window = this.INITIAL_WINDOW + waitSec * this.EXPANSION_RATE_PER_SEC;
      const candidates: MatchmakingRequest[] = [];

      for (let j = i + 1; j < this.queue.length; j++) {
        const candidate = this.queue[j];
        if (matchedUserIds.has(candidate.userId)) continue;
        if (
          anchor.mode !== candidate.mode ||
          anchor.timeControlMinutes !== candidate.timeControlMinutes ||
          (anchor.incrementSeconds ?? 0) !== (candidate.incrementSeconds ?? 0) ||
          (anchor.wallsEach ?? 10) !== (candidate.wallsEach ?? 10)
        ) {
          continue;
        }
        if (Math.abs(anchor.rating - candidate.rating) <= window) {
          candidates.push(candidate);
        }
      }

      if (candidates.length < required - 1) continue;
      const players = [anchor, ...candidates.slice(0, required - 1)];
      for (const player of players) matchedUserIds.add(player.userId);
      matchedPairs.push({
        players,
        player1: players[0],
        player2: players[1],
        mode: anchor.mode,
        timeControlMinutes: anchor.timeControlMinutes,
        incrementSeconds: anchor.incrementSeconds ?? 0,
        wallsEach: anchor.wallsEach ?? 10,
      });
    }

    if (matchedUserIds.size > 0) {
      this.queue = this.queue.filter((q) => !matchedUserIds.has(q.userId));
    }

    return matchedPairs;
  }
}
