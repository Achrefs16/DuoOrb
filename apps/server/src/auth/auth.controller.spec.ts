import { beforeEach, describe, expect, it } from 'vitest';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { ReviewerTokenService } from './reviewer-token.service.js';
import { RateLimiter } from '../guest/rate-limiter.js';
import { hashPassword } from './password.js';

describe('AuthController', () => {
  let controller: AuthController;
  let reviewerTokens: ReviewerTokenService;
  let rateLimiter: RateLimiter;
  let mockPrisma: any;
  let mockAuthService: any;

  const validEmail = 'playreview@duoorb.com';
  const validPassword = 'Review2026@DuoOrb!';
  let validHash: string;

  beforeEach(async () => {
    validHash = await hashPassword(validPassword);

    reviewerTokens = new ReviewerTokenService();
    reviewerTokens.onModuleInit();

    rateLimiter = new RateLimiter();

    mockPrisma = {
      isConnected: true,
      reviewerCredential: {
        findUnique: async ({ where }: any) => {
          if (where.email === validEmail) {
            return {
              id: 'cred-1',
              userId: 'e0000000-0000-4000-8000-000000000001',
              email: validEmail,
              passwordHash: validHash,
            };
          }
          return null;
        },
      },
    };

    mockAuthService = {
      getOrCreateUser: async (claims: any) => ({
        id: claims.sub,
        email: claims.email,
        username: 'playreview',
        displayName: 'Play Reviewer',
      }),
    };

    controller = new AuthController(
      mockPrisma,
      mockAuthService,
      reviewerTokens,
      rateLimiter
    );
  });

  it('authenticates valid reviewer credentials and returns tokens', async () => {
    const result = await controller.reviewerLogin('127.0.0.1', {
      email: validEmail,
      password: validPassword,
    });

    expect(result.userId).toBe('e0000000-0000-4000-8000-000000000001');
    expect(result.email).toBe(validEmail);
    expect(result.username).toBe('playreview');
    expect(result.displayName).toBe('Play Reviewer');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeNull();

    // Verify the returned token with ReviewerTokenService
    const claims = reviewerTokens.verify(result.accessToken);
    expect(claims?.sub).toBe('e0000000-0000-4000-8000-000000000001');
    expect(claims?.email).toBe(validEmail);
    expect(claims?.role).toBe('reviewer');
  });

  it('rejects an invalid password with UnauthorizedException', async () => {
    await expect(
      controller.reviewerLogin('127.0.0.1', {
        email: validEmail,
        password: 'WrongPassword!',
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a non-existent email with UnauthorizedException', async () => {
    await expect(
      controller.reviewerLogin('127.0.0.1', {
        email: 'unknown@duoorb.com',
        password: validPassword,
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing or malformed email and password with BadRequestException', async () => {
    await expect(
      controller.reviewerLogin('127.0.0.1', {
        email: '',
        password: validPassword,
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.reviewerLogin('127.0.0.1', {
        email: 'notanemail',
        password: validPassword,
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.reviewerLogin('127.0.0.1', {
        email: validEmail,
        password: '',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rate limits after 10 failed login attempts within window', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        controller.reviewerLogin('10.0.0.1', {
          email: validEmail,
          password: 'wrong',
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }

    // 11th attempt is rate-limited
    await expect(
      controller.reviewerLogin('10.0.0.1', {
        email: validEmail,
        password: validPassword,
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

