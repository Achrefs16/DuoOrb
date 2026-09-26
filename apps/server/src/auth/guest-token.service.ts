import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  GuestAccessClaims,
  signGuestAccessToken,
  verifyGuestAccessToken,
} from '../guest/guest-token.js';

/** Access token lifetime. Long enough that a daily player never notices. */
export const GUEST_ACCESS_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MIN_SECRET_BYTES = 32;

/**
 * Owns the guest signing keys.
 *
 * Split out of GuestService on purpose: AuthService needs to verify guest
 * tokens while GuestService needs AuthService to provision rows. Keeping the
 * keys in a leaf service with no dependencies means neither has to know about
 * the other, and there is no DI cycle.
 */
@Injectable()
export class GuestTokenService implements OnModuleInit {
  private readonly logger = new Logger(GuestTokenService.name);
  /** First entry signs; every entry verifies, so keys rotate with no downtime. */
  private secrets: Buffer[] = [];

  onModuleInit(): void {
    const raw = process.env.GUEST_TOKEN_SECRET ?? '';
    this.secrets = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Buffer.from(s, 'utf8'));

    if (this.secrets.length === 0) {
      this.logger.error(
        'GUEST_TOKEN_SECRET is not set — guest sign-in stays disabled until it is.'
      );
    } else if (this.secrets[0].length < MIN_SECRET_BYTES) {
      this.logger.error(
        `GUEST_TOKEN_SECRET must be at least ${MIN_SECRET_BYTES} characters. Refusing a short key.`
      );
      this.secrets = [];
    } else {
      this.logger.log(
        `Guest token service ready (${this.secrets.length} key(s), rotation window ${
          this.secrets.length > 1 ? 'open' : 'closed'
        }).`
      );
    }
  }

  get isConfigured(): boolean {
    return this.secrets.length > 0;
  }

  sign(userId: string): { token: string; expiresAt: Date } {
    if (!this.isConfigured) throw new Error('Guest token service is not configured.');
    return signGuestAccessToken(userId, this.secrets[0], GUEST_ACCESS_TTL_SECONDS);
  }

  /**
   * Synchronous by design: the socket gateway authenticates its handshake on
   * this path and must not await, so mutations arriving in the first
   * milliseconds after connect are not wrongly rejected.
   */
  verify(token: string | undefined | null): GuestAccessClaims | null {
    if (!token || this.secrets.length === 0) return null;
    return verifyGuestAccessToken(token, this.secrets);
  }

  verifyUserId(token: string | undefined | null): string | null {
    return this.verify(token)?.sub ?? null;
  }
}
