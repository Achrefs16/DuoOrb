import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Ip,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthService } from './auth.service.js';
import { ReviewerTokenService } from './reviewer-token.service.js';
import { verifyPassword } from './password.js';
import { RateLimiter } from '../guest/rate-limiter.js';

/** Rate limit on reviewer login to prevent brute force: 10 attempts per 15 minutes. */
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export interface ReviewerLoginDto {
  email?: string;
  password?: string;
}

export interface ReviewerLoginResponse {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
}

@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly reviewerTokens: ReviewerTokenService,
    private readonly rateLimiter: RateLimiter
  ) {}

  @Post(['reviewer/login', 'login'])
  @HttpCode(200)
  async reviewerLogin(
    @Ip() ip: string,
    @Body() body: ReviewerLoginDto,
    @Headers('user-agent') userAgent?: string
  ): Promise<ReviewerLoginResponse> {
    const rawEmail = body?.email;
    const password = body?.password;

    if (!rawEmail || typeof rawEmail !== 'string' || !rawEmail.includes('@')) {
      throw new BadRequestException('A valid email address is required.');
    }
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required.');
    }

    const email = rawEmail.trim().toLowerCase();
    const rateLimitKey = `auth:login:${RateLimiter.ipKey(ip)}:${email}`;

    if (!this.rateLimiter.allow(rateLimitKey, LOGIN_LIMIT, LOGIN_WINDOW_MS)) {
      const waitSeconds = Math.ceil(
        this.rateLimiter.retryAfterMs(rateLimitKey, LOGIN_WINDOW_MS) / 1000
      );
      this.logger.warn(`Rate limited login attempt for ${email} from ${ip}`);
      throw new ForbiddenException({
        code: 'RATE_LIMITED',
        message: `Too many login attempts. Please wait ${waitSeconds}s before trying again.`,
        retryAfter: waitSeconds,
      });
    }

    if (!this.prisma.isConnected) {
      throw new UnauthorizedException('Authentication service is currently unavailable.');
    }

    const credential = await this.prisma.reviewerCredential.findUnique({
      where: { email },
    });

    if (!credential) {
      this.logger.warn(`Reviewer login failed: account not found for ${email}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const validPassword = await verifyPassword(password, credential.passwordHash);
    if (!validPassword) {
      this.logger.warn(`Reviewer login failed: invalid password for ${email}`);
      throw new UnauthorizedException('Invalid email or password.');
    }

    const user = await this.authService.getOrCreateUser({
      sub: credential.userId,
      email: credential.email,
      user_metadata: { role: 'reviewer', full_name: 'Play Reviewer' },
    });

    const issued = this.reviewerTokens.sign(credential.userId, credential.email, user.displayName);

    this.logger.log(
      `Reviewer logged in successfully: ${email} (${user.id}) [IP: ${ip}, UA: ${userAgent?.slice(0, 50)}]`
    );

    return {
      userId: user.id,
      email: credential.email,
      username: user.username,
      displayName: user.displayName,
      accessToken: issued.token,
      refreshToken: null,
    };
  }
}

