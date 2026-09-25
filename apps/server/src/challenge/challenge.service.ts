import { GameMode } from '@duoorb/game-core';
import { ChallengeDto } from '@duoorb/protocol';

/** Friend challenges live 30s, then expire silently on both ends. */
export const CHALLENGE_TTL_MS = 30_000;

export class ChallengeService {
  private challenges = new Map<string, ChallengeDto>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  public createChallenge(
    fromUserId: string,
    fromDisplayName: string,
    toUserId: string,
    mode: GameMode,
    timeControlMinutes: number,
    incrementSeconds = 0,
    wallsEach = 10,
    onExpired?: (challenge: ChallengeDto) => void
  ): { challenge: ChallengeDto; replaced: ChallengeDto | null } {
    // One live challenge per pair — replace any stale one first.
    let replaced: ChallengeDto | null = null;
    for (const [id, c] of this.challenges) {
      if (
        (c.fromUserId === fromUserId && c.toUserId === toUserId) ||
        (c.fromUserId === toUserId && c.toUserId === fromUserId)
      ) {
        replaced = { ...c };
        this.clear(id);
      }
    }

    const now = Date.now();
    const challenge: ChallengeDto = {
      id: `ch-${now}-${Math.floor(Math.random() * 1000)}`,
      fromUserId,
      fromDisplayName,
      toUserId,
      mode,
      timeControlMinutes,
      incrementSeconds,
      wallsEach: Math.max(0, Math.min(99, Math.floor(wallsEach))),
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
    };
    this.challenges.set(challenge.id, challenge);

    const timer = setTimeout(() => {
      const pending = this.challenges.get(challenge.id);
      if (!pending) return;
      this.challenges.delete(challenge.id);
      this.timers.delete(challenge.id);
      onExpired?.(pending);
    }, CHALLENGE_TTL_MS + 500);
    // Don't hold the process open for lobby furniture.
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(challenge.id, timer);

    return { challenge, replaced };
  }

  public getChallenge(id: string): ChallengeDto | undefined {
    return this.challenges.get(id);
  }

  /** Sender backs out — receiver's toast dismisses. */
  public clear(id: string): void {
    this.challenges.delete(id);
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }

  /**
   * Resolves a challenge. Accept consumes it; decline consumes it.
   * Either way it is gone afterwards.
   */
  public resolve(
    id: string,
    byUserId: string,
    accept: boolean
  ): { success: true; challenge: ChallengeDto } | { success: false; error: string } {
    const challenge = this.challenges.get(id);
    if (!challenge) return { success: false, error: 'Challenge expired.' };
    if (challenge.toUserId !== byUserId) {
      return { success: false, error: 'Not your challenge.' };
    }
    if (Date.now() > challenge.expiresAt) {
      this.clear(id);
      return { success: false, error: 'Challenge expired.' };
    }
    this.clear(id);
    return { success: true, challenge: { ...challenge } };
  }

  public migrateUser(oldUserId: string, newUserId: string): void {
    if (oldUserId === newUserId) return;
    for (const [id, c] of this.challenges) {
      if (c.fromUserId === oldUserId) c.fromUserId = newUserId;
      if (c.toUserId === oldUserId) c.toUserId = newUserId;
      this.challenges.set(id, c);
    }
  }
}
