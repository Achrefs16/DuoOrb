import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

/** RevenueCat webhook event types we act on. Unknown types are logged only. */
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
]);

export interface RevenueCatEvent {
  /** RevenueCat `event.id` — unique per delivery, our idempotency key. */
  id: string;
  /** e.g. INITIAL_PURCHASE | RENEWAL | CANCELLATION | EXPIRATION | BILLING_ISSUE */
  type: string;
  /** Our DuoOrb userId (client sets it as the RevenueCat App User ID). */
  appUserId: string;
  productId?: string;
  /** RevenueCat `expiration_at_ms`, if the event carries one. */
  expiresAtMs?: number;
  /** RevenueCat `event_timestamp_ms`: when the event happened (stale guard). */
  occurredAtMs?: number;
}

export interface PremiumStatus {
  isPremium: boolean;
  premiumExpiresAt: Date | null;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  // Optional so the service can be constructed bare in unit tests.
  constructor(private readonly prisma?: PrismaService) {
    void this.prisma;
  }

  /**
   * Applies one verified RevenueCat webhook event. Always safe to call twice
   * with the same event (E1) and with events in any order (E2): the event row
   * is stored by rcEventId first, and only events newer than the stored
   * premiumExpiresAt move the entitlement forward.
   */
  async applyEvent(evt: RevenueCatEvent): Promise<PremiumStatus> {
    const prisma = this.prisma as any;
    const expiresAt = Number.isFinite(evt.expiresAtMs)
      ? new Date(evt.expiresAtMs as number)
      : null;

    // B1: profile check FIRST. The event row carries an FK to users(id), so
    // inserting before this check turns every unknown-user delivery (dashboard
    // test events, deleted accounts) into a 500 that RevenueCat retries
    // forever. Unknown users return inactive with no row stored.
    const profile = await prisma.profile.findUnique({
      where: { userId: evt.appUserId },
      select: { isPremium: true, premiumExpiresAt: true, premiumUpdatedAt: true },
    });
    if (!profile) {
      // Unknown user (e.g. RevenueCat sandbox/test event): log + 200, never 500.
      this.logger.warn(
        `webhook for unknown user ignored: ${evt.appUserId} (${evt.type})`
      );
      return { isPremium: false, premiumExpiresAt: null };
    }

    try {
      await prisma.subscriptionEvent.create({
        data: {
          userId: evt.appUserId,
          rcEventId: evt.id,
          eventType: evt.type,
          productId: evt.productId ?? null,
          expiresAt,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        // E1: redelivery — the first delivery already applied this event.
        // (Concurrent duplicates still serialize here: one insert wins, the
        // other lands on P2002 and reads the already-applied state.)
        this.logger.warn(`duplicate webhook event ignored: ${evt.id}`);
        return this.getStatus(evt.appUserId);
      }
      throw e;
    }

    const now = new Date();
    if (GRANT_EVENTS.has(evt.type)) {
      // E2: stale out-of-order grant must not shorten a newer entitlement.
      const stored = profile.premiumExpiresAt
        ? new Date(profile.premiumExpiresAt).getTime()
        : 0;
      const incoming = expiresAt ? expiresAt.getTime() : 0;
      if (!expiresAt || incoming > stored) {
        await prisma.profile.update({
          where: { userId: evt.appUserId },
          data: {
            isPremium: true,
            ...(expiresAt ? { premiumExpiresAt: expiresAt } : {}),
            premiumSource: 'revenuecat',
            premiumUpdatedAt: now,
          },
        });
        return {
          isPremium: true,
          premiumExpiresAt: expiresAt ?? profile.premiumExpiresAt,
        };
      }
      return {
        isPremium: profile.isPremium,
        premiumExpiresAt: profile.premiumExpiresAt,
      };
    }

    if (evt.type === 'CANCELLATION') {
      // E3: keep the paid period — Play policy. Expiry flips it later
      // (EXPIRATION event or lazy-expiry on /me).
      return {
        isPremium: profile.isPremium,
        premiumExpiresAt: profile.premiumExpiresAt,
      };
    }

    if (evt.type === 'EXPIRATION') {
      // E5: a refund/revoke ends access at once. E2 (stale delivery): a
      // delayed expiration from BEFORE the last entitlement change must not
      // kill a newer grant or ignore a real revoke. Dates alone cannot tell
      // "stale expiry" from "refund" (both predate the stored expiry), so the
      // arbiter is WHEN the event happened: RevenueCat's event_timestamp_ms
      // older than our last entitlement write means this delivery lost a race
      // with a newer event we already applied. Null timestamp or null
      // stored write-time → apply (nothing to compare).
      const occurredAt = Number.isFinite(evt.occurredAtMs)
        ? (evt.occurredAtMs as number)
        : 0;
      const lastWrite =
        profile.premiumUpdatedAt != null
          ? new Date(profile.premiumUpdatedAt).getTime()
          : 0;
      if (occurredAt > 0 && lastWrite > 0 && occurredAt < lastWrite) {
        this.logger.warn(
          `stale expiration ignored for ${evt.appUserId} (occurred before last entitlement write)`
        );
        return {
          isPremium: profile.isPremium,
          premiumExpiresAt: profile.premiumExpiresAt,
        };
      }
      await prisma.profile.update({
        where: { userId: evt.appUserId },
        data: {
          isPremium: false,
          ...(expiresAt ? { premiumExpiresAt: expiresAt } : {}),
          premiumUpdatedAt: now,
        },
      });
      return {
        isPremium: false,
        premiumExpiresAt: expiresAt ?? profile.premiumExpiresAt,
      };
    }

    // BILLING_ISSUE and anything unknown: E4 — grace/account-hold covers the
    // user; the entitlement is untouched.
    this.logger.log(`webhook noted without entitlement change: ${evt.type}`);
    return {
      isPremium: profile.isPremium,
      premiumExpiresAt: profile.premiumExpiresAt,
    };
  }

  /**
   * Batch premium check for match creation (P5.2): which of these users hold
   * an EFFECTIVE premium right now (stored true + expiry in the future).
   * Frozen per match — a mid-match subscription shows from the next game, so
   * seat badges never pop in late and shift card layout. Never throws: on any
   * DB failure every seat simply renders without a badge.
   */
  async premiumUserIdsFor(userIds: string[]): Promise<string[]> {
    try {
      const prisma = this.prisma as any;
      if (!prisma?.profile || userIds.length === 0) return [];
      const now = Date.now();
      const rows = await prisma.profile.findMany({
        where: { userId: { in: [...new Set(userIds)] } },
        select: { userId: true, isPremium: true, premiumExpiresAt: true },
      });
      return rows
        .filter(
          (p: any) =>
            p.isPremium === true &&
            (!p.premiumExpiresAt || new Date(p.premiumExpiresAt).getTime() > now)
        )
        .map((p: any) => p.userId);
    } catch (e) {
      this.logger.warn(`premiumUserIdsFor failed: ${(e as Error)?.message}`);
      return [];
    }
  }

  /**
   * Authoritative premium read with lazy expiry: if the stored expiry passed
   * and no webhook has flipped the flag yet, flip it here so callers never
   * see a stale `true`. Covers missed webhooks and grace-period overruns.
   */
  async getStatus(userId: string): Promise<PremiumStatus> {
    const prisma = this.prisma as any;
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { isPremium: true, premiumExpiresAt: true },
    });
    if (!profile) return { isPremium: false, premiumExpiresAt: null };
    if (
      profile.isPremium &&
      profile.premiumExpiresAt &&
      new Date(profile.premiumExpiresAt).getTime() <= Date.now()
    ) {
      await prisma.profile.update({
        where: { userId },
        data: { isPremium: false, premiumUpdatedAt: new Date() },
      });
      return { isPremium: false, premiumExpiresAt: profile.premiumExpiresAt };
    }
    return {
      isPremium: profile.isPremium,
      premiumExpiresAt: profile.premiumExpiresAt,
    };
  }
}

/** Prisma's unique-constraint violation code. */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: unknown }).code === 'P2002'
  );
}
