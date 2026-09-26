import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Ip,
  Post,
} from '@nestjs/common';
import { GuestService } from './guest.service.js';
import { RateLimiter } from './rate-limiter.js';

/** Guest creation is unauthenticated, so it is rate limited per IP. */
const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 60 * 60 * 1000; // 5 per hour
const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_MS = 60 * 60 * 1000; // 30 per hour

@Controller('api/guest')
export class GuestController {
  constructor(
    private readonly guestService: GuestService,
    private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Mints a guest identity. The device sends nothing it can be trusted about —
   * the server allocates the id, the profile, the rating and the tokens.
   */
  @Post()
  @HttpCode(201)
  async create(
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string
  ) {
    this.assertAllowed(ip, 'create', CREATE_LIMIT, CREATE_WINDOW_MS);
    return this.guestService.createGuest({
      ipHash: RateLimiter.ipKey(ip),
      userAgent,
    });
  }

  /**
   * Exchanges a refresh token for a new pair. Both tokens rotate, and a
   * replayed token revokes the session.
   */
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Ip() ip: string,
    @Body() body: { refreshToken?: string },
    @Headers('user-agent') userAgent?: string
  ) {
    this.assertAllowed(ip, 'refresh', REFRESH_LIMIT, REFRESH_WINDOW_MS);
    if (!body?.refreshToken) {
      throw new ForbiddenException('Missing refreshToken.');
    }
    return this.guestService.refreshGuest(body.refreshToken, {
      ipHash: RateLimiter.ipKey(ip),
      userAgent,
    });
  }

  /** Lets a freshly installed app know whether guest sign-in is available. */
  @Get('config')
  config() {
    return { enabled: this.guestService.isConfigured };
  }

  private assertAllowed(ip: string, bucket: string, limit: number, windowMs: number): void {
    if (!this.rateLimiter.allow(`${bucket}:${RateLimiter.ipKey(ip)}`, limit, windowMs)) {
      throw new ForbiddenException('Too many attempts. Try again later.');
    }
  }
}
