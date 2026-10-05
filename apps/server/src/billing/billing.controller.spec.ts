import { beforeEach, describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { BillingController } from './billing.controller.js';

/**
 * Webhook authentication (shared-secret Bearer, constant-time compare) and
 * malformed-payload handling. Payload schema validation itself is enforced by
 * the global ValidationPipe; here we cover the controller's own branches.
 */
describe('billing webhook auth', () => {
  const OLD_ENV = process.env.REVENUECAT_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = 's3cret';
  });

  const controller = (applied: any = { isPremium: true }) =>
    new BillingController({ applyEvent: async () => applied } as any);

  it('rejects a missing secret', async () => {
    await expect(
      controller().handleRevenueCat(undefined, { event: {} } as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong secret', async () => {
    await expect(
      controller().handleRevenueCat('Bearer wrong', { event: {} } as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when no secret is configured (fail closed)', async () => {
    process.env.REVENUECAT_WEBHOOK_SECRET = '';
    await expect(
      controller().handleRevenueCat('Bearer s3cret', { event: {} } as any)
    ).rejects.toBeInstanceOf(UnauthorizedException);
    process.env.REVENUECAT_WEBHOOK_SECRET = OLD_ENV;
  });

  it('acknowledges malformed payloads without applying', async () => {
    const res = await controller().handleRevenueCat('Bearer s3cret', {
      event: { id: 'x' },
    } as any);
    expect(res).toEqual({ ok: true, applied: false });
  });

  it('applies well-formed events and returns status', async () => {
    const status = { isPremium: true, premiumExpiresAt: new Date() };
    let seen: any = null;
    const ctrl = new BillingController({
      applyEvent: async (e: any) => {
        seen = e;
        return status;
      },
    } as any);
    const res = await ctrl.handleRevenueCat('Bearer s3cret', {
      event: {
        id: 'rc-1',
        type: 'RENEWAL',
        app_user_id: 'u1',
        product_id: 'duoorb_premium_yearly',
        expiration_at_ms: 123,
      },
    } as any);
    expect(res).toEqual({ ok: true, applied: true, status });
    expect(seen).toMatchObject({
      id: 'rc-1',
      type: 'RENEWAL',
      appUserId: 'u1',
    });
  });
});
