import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PrismaService } from '../database/prisma.service.js';
import { validateUsername } from '../users/username.js';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  username: string;
  displayName: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly prisma: PrismaService) {
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
   * Verifies a Supabase JWT token and extracts user identity.
   */
  async verifyToken(token: string): Promise<{ sub: string; email?: string; user_metadata?: any }> {
    if (!token) {
      throw new UnauthorizedException('Missing authentication token.');
    }

    // In local development or testing, permit dev tokens like "dev-u_abc123:email".
    // The client identity is the part AFTER the prefix ("u_abc123") — the
    // server must key everything by that same string, otherwise seat
    // resolution (and turn validation mismatches) break downstream.
    if (token.startsWith('dev-') || process.env.NODE_ENV === 'test') {
      const parts = token.split(':');
      const userId = parts[0].replace(/^dev-/, '');
      const email = parts[1] || `${userId}@example.com`;
      return { sub: userId, email, user_metadata: { full_name: `Dev ${userId.slice(0, 5)}` } };
    }

    if (!this.jwks) {
      const jwksUrl = process.env.SUPABASE_JWKS_URL;
      if (jwksUrl) {
        this.jwks = createRemoteJWKSet(new URL(jwksUrl));
      } else {
        throw new UnauthorizedException('SUPABASE_JWKS_URL not configured on server.');
      }
    }

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/auth/v1` : undefined,
      });

      const sub = payload.sub;
      if (!sub) {
        throw new UnauthorizedException('Invalid token: missing subject.');
      }

      return {
        sub,
        email: payload.email as string | undefined,
        user_metadata: payload.user_metadata,
      };
    } catch (err: any) {
      this.logger.warn(`JWT verification failed: ${err.message}`);
      throw new UnauthorizedException(`Invalid or expired token: ${err.message}`);
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
