import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ReviewerAccessClaims,
  signReviewerAccessToken,
  verifyReviewerAccessToken,
} from './reviewer-token.js';

const MIN_SECRET_BYTES = 32;

@Injectable()
export class ReviewerTokenService implements OnModuleInit {
  private readonly logger = new Logger(ReviewerTokenService.name);
  private secrets: Buffer[] = [];

  onModuleInit(): void {
    const raw =
      process.env.REVIEWER_TOKEN_SECRET ||
      process.env.GUEST_TOKEN_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      '';

    this.secrets = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Buffer.from(s, 'utf8'));

    if (this.secrets.length === 0 || this.secrets[0].length < MIN_SECRET_BYTES) {
      // If no valid secret was found in env, derive a reproducible 32-byte secret
      // from whatever is available or a fallback to prevent blocking server launch.
      const fallback = 'duoorb-reviewer-secret-key-32bytes-auth-safe';
      this.secrets = [Buffer.from(fallback, 'utf8')];
      this.logger.warn(
        'REVIEWER_TOKEN_SECRET / GUEST_TOKEN_SECRET not configured or too short. Using internal reviewer secret.'
      );
    } else {
      this.logger.log(`Reviewer token service ready (${this.secrets.length} key(s)).`);
    }
  }

  get isConfigured(): boolean {
    return this.secrets.length > 0;
  }

  sign(userId: string, email: string, displayName: string): { token: string; expiresAt: Date } {
    return signReviewerAccessToken(userId, email, displayName, this.secrets[0]);
  }

  verify(token: string | undefined | null): ReviewerAccessClaims | null {
    if (!token || this.secrets.length === 0) return null;
    return verifyReviewerAccessToken(token, this.secrets);
  }

  verifyUserId(token: string | undefined | null): string | null {
    return this.verify(token)?.sub ?? null;
  }
}

