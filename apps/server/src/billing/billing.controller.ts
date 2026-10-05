import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { BillingService } from './billing.service.js';
import { RevenueCatWebhookDto } from './revenuecat.dto.js';

/**
 * RevenueCat webhook receiver. PUBLIC route (RevenueCat cannot present a user
 * JWT) — authenticity comes from the shared-secret Bearer token, compared in
 * constant time like guest-token verification. Unknown users and unknown event
 * types return 200 (RevenueCat retries 5xx aggressively; a 500 loop on a test
 * event would spam us).
 */
@Controller('api/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  @Post('revenuecat')
  @HttpCode(200)
  async handleRevenueCat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: RevenueCatWebhookDto
  ) {
    this.assertWebhookSecret(authorization);
    const evt = body?.event;
    // NOTE: snake_case — these are RevenueCat's wire names, kept as-is in the DTO.
    if (!evt || !evt.id || !evt.type || !evt.app_user_id) {
      // Malformed (dashboard "test" pings included): acknowledge, change nothing.
      this.logger.warn('malformed revenuecat webhook ignored');
      return { ok: true, applied: false };
    }
    const status = await this.billing.applyEvent({
      id: evt.id,
      type: evt.type,
      appUserId: evt.app_user_id,
      productId: evt.product_id,
      expiresAtMs: evt.expiration_at_ms,
      occurredAtMs: evt.event_timestamp_ms,
    });
    return { ok: true, applied: true, status };
  }

  /**
   * E6: accepts a comma-separated secret list so rotation is hitless — old and
   * new secrets verify during the overlap window.
   */
  private assertWebhookSecret(authorization: string | undefined): void {
    const configured = (process.env.REVENUECAT_WEBHOOK_SECRET ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const presented = (authorization ?? '').replace(/^Bearer\s+/i, '');
    if (configured.length === 0 || !presented) {
      throw new UnauthorizedException('Missing webhook credentials.');
    }
    const presentedBuf = Buffer.from(presented);
    const match = configured.some((secret) => {
      const secretBuf = Buffer.from(secret);
      return (
        secretBuf.length === presentedBuf.length &&
        timingSafeEqual(secretBuf, presentedBuf)
      );
    });
    if (!match) {
      // Log a fingerprint (never the secret) so misconfiguration is debuggable.
      const fp = createHmac('sha256', 'duoorb-webhook')
        .update(presented)
        .digest('hex')
        .slice(0, 12);
      this.logger.warn(`rejected webhook with unknown secret (fp ${fp})`);
      throw new UnauthorizedException('Invalid webhook credentials.');
    }
  }
}
