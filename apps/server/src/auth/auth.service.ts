import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../database/prisma.service.js';
import { GuestTokenService } from './guest-token.service.js';
import { validateUsername } from '../users/username.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  username: string;
  displayName: string;
}

export type AuthFailureReason = 'missing' | 'expired' | 'invalid' | 'unavailable';

/**
 * A verification failure with enough detail for the client to distinguish a
 * dead credential from a transient dependency outage. Without this every
 * JWKS/network hiccup was reported as "Invalid or expired token", so the
 * client refreshed once, got the same token, and parked the session.
 */
export class AuthVerificationError extends UnauthorizedException {
  constructor(
    message: string,
    public readonly authReason: AuthFailureReason,
    public readonly authRetryable: boolean
  ) {
    super(message);
  }

  /** Kept as a non-enumerable-friendly alias for older catch sites. */
  get retryable(): boolean {
    return this.authRetryable;
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly guestTokens: GuestTokenService
  ) {
    const jwksUrl = process.env.SUPABASE_JWKS_URL;
    if (jwksUrl) {
      try {
        this.jwks = createRemoteJWKSet(new URL(jwksUrl));
      } catch (err: any) {
        this.logger.error(`Failed to initialize Supabase JWKS from ${jwksUrl}: ${err.message}`);
      }
    }
  }

  /**
   * Verifies a bearer token and extracts user identity.
   *
   * Two accepted kinds:
   *  - a guest access token, minted and signed by this server
   *  - a Supabase account JWT, verified against Supabase's JWKS
   *
   * There is deliberately no third path. Previously any string starting with
   * "dev-" was trusted, which meant anyone could claim any account in
   * production; guests now present a signed token instead.
   */
  async verifyToken(token: string): Promise<{ sub: string; email?: string; user_metadata?: any }> {
    if (!token) {
      throw new AuthVerificationError('Missing authentication token.', 'missing', false);
    }

    // Guest tokens are local HMACs, so this is fast and works before Supabase
    // is reachable.
    const guestUserId = this.guestTokens.verifyUserId(token);
    if (guestUserId) {
      return {
        sub: guestUserId,
        user_metadata: { role: 'guest' },
      };
    }

    if (!this.jwks) {
      const jwksUrl = process.env.SUPABASE_JWKS_URL;
      if (jwksUrl) {
        this.jwks = createRemoteJWKSet(new URL(jwksUrl));
      } else {
        throw new AuthVerificationError(
          'SUPABASE_JWKS_URL not configured on server.',
          'unavailable',
          false
        );
      }
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/auth/v1` : undefined,
      });

      const sub = payload.sub;
      if (!sub) {
        throw new AuthVerificationError('Invalid token: missing subject.', 'invalid', false);
      }

      return {
        sub,
        email: payload.email as string | undefined,
        user_metadata: payload.user_metadata,
      };
    } catch (err: any) {
      if (err instanceof AuthVerificationError) throw err;
      const message = String(err?.message ?? 'unknown verification error');
      const code = String(err?.code ?? '');
      this.logger.warn(`JWT verification failed: ${message}`);
      // `jose` distinguishes token failures from JWKS fetch failures only by
      // code/message. Treat explicit expiry as terminal; treat network and
      // JWKS timeouts as retryable so a brief Supabase outage does not park a
      // perfectly valid account.
      const transient =
        code === 'ERR_JWKS_TIMEOUT' ||
        code === 'ERR_JWKS_NO_MATCHING_KEY' ||
        /fetch failed|network|timed? ?out|ECONN|ENOTFOUND|EAI_AGAIN/i.test(message);
      const expired =
        code === 'ERR_JWT_EXPIRED' ||
        /jwt expired|token expired|expired/i.test(message);
      if (transient) {
        throw new AuthVerificationError(
          `Authorization service unavailable: ${message}`,
          'unavailable',
          true
        );
      }
      throw new AuthVerificationError(
        `Invalid or expired token: ${message}`,
        expired ? 'expired' : 'invalid',
        false
      );
    }
  }

  /**
   * Ensures User, Profile, and initial Rating records exist in PostgreSQL.
   */
  async getOrCreateUser(claims: { sub: string; email?: string; user_metadata?: any }): Promise<AuthenticatedUser> {
    const userId = claims.sub;
    const email = claims.email;
    const metadata = claims.user_metadata || {};

    const fallbackUsername = `player_${userId.substring(0, 6)}`;
    const fallbackDisplayName = metadata.full_name || metadata.name || fallbackUsername;

    if (!this.prisma.isConnected) {
      // Graceful fallback when database is not connected
      return {
        id: userId,
        email,
        username: fallbackUsername,
        displayName: fallbackDisplayName,
      };
    }

    try {
      // Upsert User
      await this.prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email,
        },
        update: {
          email,
        },
      });

      // Ensure Profile exists
      let profile = await this.prisma.profile.findUnique({
        where: { userId },
      });

      if (!profile) {
        // An OAuth provider's suggested handle is untrusted: it can contain
        // spaces/emoji, violate the app's charset policy, or simply collide
        // with an existing player. Fall back to the generated handle so a
        // broken @handle is never persisted — the player can claim a real
        // one from the account screen.
        const suggested = validateUsername(metadata.username);
        const username = suggested.ok ? suggested.value : fallbackUsername;
        profile = await this.prisma.profile.create({
          data: {
            userId,
            username,
            displayName: fallbackDisplayName,
            avatarUrl: metadata.avatar_url || null,
          },
        });
      }

      // Ensure the single universal rating row exists (all ranked modes
      // share it; legacy per-mode rows were migrated away).
      await this.prisma.rating.upsert({
        where: { userId },
        create: {
          userId,
          rating: 1500.0,
          rd: 350.0,
          vol: 0.06,
        },
        update: {},
      });

      return {
        id: userId,
        email,
        username: profile.username,
        displayName: profile.displayName,
      };
    } catch (err: any) {
      this.logger.error(`Error ensuring user record for ${userId}: ${err.message}`);
      return {
        id: userId,
        email,
        username: fallbackUsername,
        displayName: fallbackDisplayName,
      };
    }
  }
}
