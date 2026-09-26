import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { GuestTokenService } from '../auth/guest-token.service.js';
import { newOpaqueToken, newRefreshToken, sha256 } from './guest-token.js';

/** Refresh token lifetime. A guest who installs and never returns is swept. */
export const GUEST_REFRESH_TTL_DAYS = 180;
/** How often expired sessions are purged. */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Guest user ids keep the `u_` prefix that /api/users/link validates. */
const GUEST_ID_PREFIX = 'u_';
const GUEST_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const GUEST_ID_RETRIES = 8;

const ADJECTIVES = [
  'Swift', 'Bold', 'Silent', 'Cosmic', 'Solar', 'Lunar', 'Echo', 'Neon', 'Apex', 'Shadow',
];
const NOUNS = [
  'Orb', 'Striker', 'Player', 'Tactician', 'Runner', 'Walker', 'Master', 'Spark', 'Pulse', 'Vanguard',
];

export interface IssuedGuestCredentials {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
  displayName: string;
  accessExpiresAt: number;
}

/**
 * Server-owned guest identity.
 *
 * The device never invents its own credentials: it asks for a guest, and the
 * server signs the access token and stores only a hash of the refresh token.
 * That is what makes impersonation impossible — there is no longer a string a
 * client can fabricate and have believed.
 */
@Injectable()
export class GuestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GuestService.name);
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly tokens: GuestTokenService
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      void this.purgeExpired();
    }, CLEANUP_INTERVAL_MS);
    // Do not hold the event loop open just for the sweeper.
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  get isConfigured(): boolean {
    return this.tokens.isConfigured;
  }

  private assertUsable(): void {
    if (!this.tokens.isConfigured) {
      throw new UnauthorizedException('Guest sign-in is not available.');
    }
    if (!this.prisma.isConnected) {
      throw new UnauthorizedException('Guest sign-in is unavailable right now.');
    }
  }

  /** Creates a brand-new guest: identity rows, tokens, and session record. */
  async createGuest(meta: { ipHash?: string; userAgent?: string }): Promise<IssuedGuestCredentials> {
    this.assertUsable();

    const userId = await this.reserveGuestId();
    // Reuse the account provisioning path so a guest ends up with an identical
    // set of rows: User + Profile (with a generated handle) + Rating.
    //
    // The display name must be passed explicitly. getOrCreateUser falls back
    // to the *username* when no name is supplied, which made every guest
    // appear in matches as "player_u_xxxxxxxx" instead of a real name.
    const user = await this.authService.getOrCreateUser({
      sub: userId,
      user_metadata: { full_name: generateGuestDisplayName() },
    });

    const issued = this.signCredentials(userId);
    await this.prisma.guestSession.create({
      data: {
        userId: user.id,
        tokenHash: sha256(issued.refreshToken),
        expiresAt: this.refreshExpiry(),
        ipHash: meta.ipHash ?? null,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      },
    });

    return { ...issued, userId: user.id, username: user.username, displayName: user.displayName };
  }

  /**
   * Exchanges a refresh token for a new pair, rotating both.
   *
   * Presenting a token that was already rotated away means it was captured, so
   * the whole session is revoked rather than merely rejected.
   */
  async refreshGuest(
    refreshToken: string,
    meta: { ipHash?: string; userAgent?: string }
  ): Promise<IssuedGuestCredentials> {
    this.assertUsable();
    if (!refreshToken) throw new UnauthorizedException('Invalid guest session.');

    const presented = sha256(refreshToken);
    const session = await this.prisma.guestSession.findUnique({
      where: { tokenHash: presented },
    });

    if (!session) {
      // Already-rotated token coming back: assume theft and burn the session.
      const replayed = await this.prisma.guestSession.findFirst({
        where: { prevTokenHash: presented },
      });
      if (replayed) {
        await this.prisma.guestSession.update({
          where: { id: replayed.id },
          data: { revokedAt: new Date() },
        });
        this.logger.warn(
          `Guest refresh token replay detected on session ${replayed.id}; session revoked.`
        );
      }
      throw new UnauthorizedException('Invalid guest session.');
    }

    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Guest session expired.');
    }

    const issued = this.signCredentials(session.userId);

    await this.prisma.guestSession.update({
      where: { id: session.id },
      data: {
        // Rotate: the presented token stops working the moment this lands.
        prevTokenHash: session.tokenHash,
        tokenHash: sha256(issued.refreshToken),
        expiresAt: this.refreshExpiry(),
        lastUsedAt: new Date(),
        ipHash: meta.ipHash ?? session.ipHash,
        userAgent: meta.userAgent?.slice(0, 255) ?? session.userAgent,
      },
    });

    // A name is supplied as a fallback only: for an existing guest the
    // profile is found and kept, so this never overwrites a chosen name.
    const user = await this.authService.getOrCreateUser({
      sub: session.userId,
      user_metadata: { full_name: generateGuestDisplayName() },
    });
    return {
      ...issued,
      userId: session.userId,
      username: user.username,
      displayName: user.displayName,
    };
  }

  /**
   * Kills a guest's session. Called when a guest is merged into a real
   * account so the old credentials cannot be replayed afterwards.
   */
  async revokeForUser(userId: string): Promise<void> {
    if (!this.prisma.isConnected) return;
    try {
      await this.prisma.guestSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.warn(`Could not revoke guest sessions for ${userId}: ${err?.message}`);
    }
  }

  /** Verifies a guest access token synchronously (socket handshake path). */
  verifyAccessToken(token: string | undefined | null): string | null {
    return this.tokens.verifyUserId(token);
  }

  private signCredentials(userId: string) {
    const { token, expiresAt } = this.tokens.sign(userId);
    return {
      accessToken: token,
      refreshToken: newRefreshToken(),
      accessExpiresAt: expiresAt.getTime(),
    };
  }

  private refreshExpiry(): Date {
    return new Date(Date.now() + GUEST_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  /**
   * Finds an unused `u_xxxxxxxx` id. Provisioning creates the row, so the id
   * has to be free before we hand it over.
   */
  private async reserveGuestId(): Promise<string> {
    for (let attempt = 0; attempt < GUEST_ID_RETRIES; attempt++) {
      let body = '';
      for (let i = 0; i < 8; i++) {
        body += GUEST_ID_CHARS[Math.floor(Math.random() * GUEST_ID_CHARS.length)];
      }
      const candidate = `${GUEST_ID_PREFIX}${body}`;
      const taken = await this.prisma.user.findUnique({
        where: { id: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    throw new UnauthorizedException('Could not allocate a guest identity.');
  }

  private async purgeExpired(): Promise<void> {
    if (!this.prisma.isConnected) return;
    try {
      const { count } = await this.prisma.guestSession.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
      });
      if (count > 0) this.logger.log(`Purged ${count} expired/revoked guest session(s).`);
    } catch (err: any) {
      this.logger.warn(`Guest session cleanup failed: ${err?.message}`);
    }
  }
}

/** Random display name for a new guest, matching the client's word lists. */
export function generateGuestDisplayName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
}

export { newOpaqueToken };
