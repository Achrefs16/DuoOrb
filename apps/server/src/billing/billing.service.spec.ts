import { describe, it, expect } from 'vitest';
import { BillingService } from './billing.service.js';

/**
 * Premium entitlement edge cases (MONETIZATION.md E1–E4 + lazy expiry).
 *
 * The mock emulates the two Prisma calls the service relies on plus the
 * P2002 unique-violation path used for webhook idempotency.
 */
function makePrisma(opts?: {
  profile?: { isPremium: boolean; premiumExpiresAt: Date | null } | null;
}) {
  const hasProfile = !!opts && 'profile' in opts;
  const state = {
    events: [] as any[],
    profile: hasProfile
      ? (opts!.profile as any)
      : { isPremium: false, premiumExpiresAt: null },
    updates: [] as any[],
  };
  return {
    state,
    subscriptionEvent: {
      create: async ({ data }: any) => {
        if (state.events.some((e) => e.rcEventId === data.rcEventId)) {
          throw { code: 'P2002' };
        }
        state.events.push(data);
        return data;
      },
    },
    profile: {
      findUnique: async () => state.profile,
      update: async ({ data }: any) => {
        state.updates.push(data);
        state.profile = { ...state.profile, ...data };
        return state.profile;
      },
    },
  } as any;
}

const grant = (over: Record<string, unknown> = {}) => ({
  id: 'rc-1',
  type: 'INITIAL_PURCHASE',
  appUserId: 'u1',
  productId: 'duoorb_premium_monthly',
  expiresAtMs: Date.now() + 30 * 24 * 3600 * 1000,
  ...over,
});

describe('billing webhook idempotency (E1)', () => {
  it('applies a redelivered event exactly once', async () => {
    const prisma = makePrisma();
    const svc = new BillingService(prisma);
    const first = await svc.applyEvent(grant());
    const second = await svc.applyEvent(grant());
    expect(first.isPremium).toBe(true);
    expect(second.isPremium).toBe(true);
    expect(prisma.state.events).toHaveLength(1);
    expect(prisma.state.updates).toHaveLength(1);
  });
});

describe('billing out-of-order delivery (E2)', () => {
  it('ignores a stale grant that would shorten a newer entitlement', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      },
    });
    const svc = new BillingService(prisma);
    const res = await svc.applyEvent(
      grant({ id: 'rc-old', expiresAtMs: Date.now() + 24 * 3600 * 1000 })
    );
    expect(res.isPremium).toBe(true);
    expect(res.premiumExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + 300 * 24 * 3600 * 1000
    );
    expect(prisma.state.updates).toHaveLength(0);
  });

  it('extends the entitlement when the grant is newer', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const svc = new BillingService(prisma);
    const res = await svc.applyEvent(
      grant({ id: 'rc-new', expiresAtMs: Date.now() + 365 * 24 * 3600 * 1000 })
    );
    expect(res.isPremium).toBe(true);
    expect(res.premiumExpiresAt?.getTime()).toBeGreaterThan(
      Date.now() + 300 * 24 * 3600 * 1000
    );
    expect(prisma.state.updates).toHaveLength(1);
  });
});

describe('billing cancellation and expiry (E3)', () => {
  it('keeps the paid period on CANCELLATION, ends it on EXPIRATION', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
    });
    const svc = new BillingService(prisma);
    const cancelled = await svc.applyEvent({
      id: 'rc-cancel',
      type: 'CANCELLATION',
      appUserId: 'u1',
    });
    expect(cancelled.isPremium).toBe(true);
    expect(prisma.state.updates).toHaveLength(0);
    const expired = await svc.applyEvent({
      id: 'rc-expire',
      type: 'EXPIRATION',
      appUserId: 'u1',
      expiresAtMs: Date.now() - 1000,
    });
    expect(expired.isPremium).toBe(false);
  });

  it('ignores a stale expiration that lost a race with a renewal (E2)', async () => {
    const now = Date.now();
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(now + 365 * 24 * 3600 * 1000),
        premiumUpdatedAt: new Date(now),
      } as never,
    });
    const svc = new BillingService(prisma);
    // Delayed delivery of last year's expiry, occurring long before the
    // renewal we already applied: must not kill the live entitlement.
    const res = await svc.applyEvent({
      id: 'rc-stale-expire',
      type: 'EXPIRATION',
      appUserId: 'u1',
      expiresAtMs: now - 300 * 24 * 3600 * 1000,
      occurredAtMs: now - 300 * 24 * 3600 * 1000,
    });
    expect(res.isPremium).toBe(true);
    expect(prisma.state.updates).toHaveLength(0);
  });

  it('still applies a real refund that occurred after the last write', async () => {
    const now = Date.now();
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(now + 10 * 24 * 3600 * 1000),
        premiumUpdatedAt: new Date(now - 10 * 24 * 3600 * 1000),
      } as never,
    });
    const svc = new BillingService(prisma);
    const res = await svc.applyEvent({
      id: 'rc-refund',
      type: 'EXPIRATION',
      appUserId: 'u1',
      expiresAtMs: now - 1000,
      occurredAtMs: now - 1000,
    });
    expect(res.isPremium).toBe(false);
  });
});

describe('billing issue grace (E4)', () => {
  it('leaves the entitlement untouched on BILLING_ISSUE', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
    });
    const svc = new BillingService(prisma);
    const res = await svc.applyEvent({
      id: 'rc-issue',
      type: 'BILLING_ISSUE',
      appUserId: 'u1',
    });
    expect(res.isPremium).toBe(true);
    expect(prisma.state.updates).toHaveLength(0);
  });
});

describe('premium lazy expiry', () => {
  it('flips a stale true to false on read', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() - 1000),
      },
    });
    const svc = new BillingService(prisma);
    const res = await svc.getStatus('u1');
    expect(res.isPremium).toBe(false);
    expect(prisma.state.updates).toHaveLength(1);
  });

  it('leaves a live entitlement alone', async () => {
    const prisma = makePrisma({
      profile: {
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
      },
    });
    const svc = new BillingService(prisma);
    const res = await svc.getStatus('u1');
    expect(res.isPremium).toBe(true);
    expect(prisma.state.updates).toHaveLength(0);
  });
});

describe('unknown webhook user', () => {
  it('logs the event and returns inactive without failing', async () => {
    const prisma = makePrisma({ profile: null });
    const svc = new BillingService(prisma);
    const res = await svc.applyEvent(grant());
    expect(res).toEqual({ isPremium: false, premiumExpiresAt: null });
    // B1: no event row may be stored for unknown users (FK would 500-loop).
    expect(prisma.state.events).toHaveLength(0);
  });
});

describe('premiumUserIdsFor (P5.2 seat badges)', () => {
  const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
  const past = new Date(Date.now() - 1000);
  const prismaFor = (rows: any[]) =>
    ({
      profile: { findMany: async () => rows },
    }) as any;

  it('returns only effectively-premium users', async () => {
    const prisma = prismaFor([
      { userId: 'u1', isPremium: true, premiumExpiresAt: future },
      { userId: 'u2', isPremium: true, premiumExpiresAt: past },
      { userId: 'u3', isPremium: true, premiumExpiresAt: null },
      { userId: 'u4', isPremium: false, premiumExpiresAt: null },
    ]);
    const svc = new BillingService(prisma);
    expect(await svc.premiumUserIdsFor(['u1', 'u2', 'u3', 'u4'])).toEqual([
      'u1',
      'u3',
    ]);
  });

  it('returns [] for empty input and on DB failure', async () => {
    const svc = new BillingService(prismaFor([]));
    expect(await svc.premiumUserIdsFor([])).toEqual([]);
    const failing = new BillingService({
      profile: {
        findMany: async () => {
          throw new Error('db down');
        },
      },
    } as any);
    expect(await failing.premiumUserIdsFor(['u1'])).toEqual([]);
  });
});
