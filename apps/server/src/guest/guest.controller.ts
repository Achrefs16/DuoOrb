import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Ip,
  Logger,
  Post,
} from '@nestjs/common';
import { GuestService } from './guest.service.js';
import { RateLimiter } from './rate-limiter.js';

/**
 * Guest creation is unauthenticated, so it is rate limited per IP.
 *
 * These numbers are budgets, not security barriers. A guest identity is minted
 * roughly once per install, so the previous 5/hour was small enough to lock
 * out a real household: every device behind one home router shares a public
 * NAT address, and the limiter counts that address, not the device. Two
 * phones and a couple of reinstalls exhausted it, and because the counter is
 * held in server memory, reinstalling the app could not recover — only a
 * server restart cleared it. Anything that throttles a paying player needs
 * headroom for shared-IP traffic (NAT, CGNAT, corporate egress, mobile
 * carriers), so the limit is generous and the sliding window in RateLimiter
 * does the real smoothing.
 */
const CREATE_LIMIT = 60;
const CREATE_WINDOW_MS = 60 * 60 * 1000; // 60 per hour
const REFRESH_LIMIT = 60;
const REFRESH_WINDOW_MS = 60 * 60 * 1000; // 60 per hour

@Controller('api/guest')
export class GuestController {
  private readonly logger = new Logger(GuestController.name);

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
      // Logged because a silent 403 here is indistinguishable from a network
      // failure on the client, which turns a rate limit into a multi-hour
      // debugging session. The bucket name and limit identify the throttle;
      // the IP is logged raw because this is server-side diagnostics only.
      this.logger.warn(
        `Rate limited guest ${bucket} for ${ip} (limit ${limit} per ${Math.round(windowMs / 1000)}s)`
      );
      throw new ForbiddenException('Too many attempts. Try again later.');
    }
  }
}
