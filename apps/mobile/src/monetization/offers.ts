import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { getIdentity } from '../network/auth';
import { ingestMe, recordLocalPurchase, refreshPremium } from './premium';
import { track } from './analytics';

/**
 * Premium offerings (MONETIZATION.md P7.1 + D9 promos).
 *
 * Prices ALWAYS render from data, never hardcoded copy:
 * - RevenueCat configured (P0.5 key present) → live packages: `priceString`
 *   plus `introPrice` when a P0.8 promo offer is active ("$2.99 first month,
 *   then $3.99" renders itself).
 * - Key missing → static fallback plans with `purchaseAvailable: false`: the
 *   sheet shows real prices with a "coming soon" buy state. No dead buttons,
 *   no fake purchases, and P0.5 lights everything up with zero UI changes.
 */

export type PlanId = 'monthly' | 'yearly';

export interface PremiumPlan {
  id: PlanId;
  title: string;
  /** Localised price line, e.g. "$3.99/mo" or "$2.99 first month, then $3.99/mo". */
  priceLine: string;
  /** Short trial line for disclosure, or null when the product has none. */
  trialLine: string | null;
  /** "Best value" marker. */
  featured?: boolean;
  rcPackage?: PurchasesPackage;
}

export interface OffersResult {
  plans: PremiumPlan[];
  /** False until the RevenueCat key + products exist (P0.5). */
  purchaseAvailable: boolean;
  /**
   * WHY purchases are unavailable (dev diagnostics only — the sheet shows
   * it in __DEV__ so testing is never blind; production copy is unchanged).
   * - 'no-key': EXPO_PUBLIC_REVENUECAT_ANDROID_KEY missing from this build.
   * - 'no-products': offering `duoorb_premium` lacks $rc_monthly/$rc_annual.
   * - 'store-error': key present but getOfferings threw (no native Purchases
   *   module — e.g. Expo Go — no Play Store, or offline).
   */
  reason?: 'no-key' | 'no-products' | 'store-error';
}

const ENTITLEMENT_ID = 'premium';
const OFFERING_ID = 'duoorb_premium';

const FALLBACK_PLANS: PremiumPlan[] = [
  {
    id: 'monthly',
    title: 'Monthly',
    priceLine: '$3.99/mo',
    trialLine: '7-day free trial, then $3.99/month',
  },
  {
    id: 'yearly',
    title: 'Yearly',
    priceLine: '$24.99/yr',
    trialLine: '7-day free trial, then $24.99/year',
    featured: true,
  },
];

function publicKey(): string {
  return (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '').trim();
}

let configuredKey: string | null = null;
let configuredUser: string | null = null;
let listenerRegistered = false;

export async function initializePurchases(userId?: string): Promise<void> {
  const key = publicKey();
  if (!key) return;
  try {
    const identity = getIdentity();
    const appUserID = userId ?? (identity?.userId && !identity.isGuest ? identity.userId : undefined);
    if (configuredKey !== key) {
      if (appUserID) {
        Purchases.configure({ apiKey: key, appUserID });
      } else {
        Purchases.configure({ apiKey: key });
      }
      configuredKey = key;
      configuredUser = appUserID ?? null;
    } else if (appUserID && configuredUser !== appUserID) {
      await Purchases.logIn(appUserID);
      configuredUser = appUserID;
    }

    if (!listenerRegistered && typeof Purchases.addCustomerInfoUpdateListener === 'function') {
      listenerRegistered = true;
      Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        const entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
        if (entitlement) {
          ingestMe({
            isPremium: true,
            premiumExpiresAt: entitlement.expirationDate ?? null,
            isCancelled: entitlement.willRenew === false,
            willRenew: entitlement.willRenew !== false,
          });
        }
      });
    }
  } catch {
    // Non-fatal
  }
}

async function ensureConfigured(): Promise<string | undefined> {
  const key = publicKey();
  if (!key) throw codedError('not-configured', 'Purchases not configured yet.');
  const identity = getIdentity();
  const appUserID = identity?.userId && !identity.isGuest ? identity.userId : undefined;
  if (configuredKey !== key) {
    if (appUserID) {
      Purchases.configure({ apiKey: key, appUserID });
    } else {
      Purchases.configure({ apiKey: key });
    }
    configuredKey = key;
    configuredUser = appUserID ?? null;
  } else if (appUserID && configuredUser !== appUserID) {
    await Purchases.logIn(appUserID);
    configuredUser = appUserID;
  }
  return appUserID;
}

function detectFreeTrial(pkg: PurchasesPackage): { hasTrial: boolean; trialLine: string | null } {
  const product = pkg.product;
  const base = pkg.identifier === '$rc_monthly' ? `${product.priceString}/mo` : `${product.priceString}/yr`;

  // 1. Google Play defaultOption pricing phase (freePhase where price is 0)
  const defaultOpt = (product as any)?.defaultOption;
  const freePhase = defaultOpt?.freePhase;
  if (freePhase) {
    const period = freePhase.billingPeriod;
    const isWeekOr7D =
      period?.iso8601 === 'P1W' ||
      period?.iso8601 === 'P7D' ||
      (period?.unit === 'DAY' && period?.value === 7) ||
      (period?.unit === 'WEEK' && period?.value === 1);
    const label = isWeekOr7D
      ? `7-day free trial, then ${base}`
      : `${period?.value ?? 7}-${String(period?.unit ?? 'day').toLowerCase()} free trial, then ${base}`;
    return { hasTrial: true, trialLine: label };
  }

  // 2. introPrice (iOS or legacy Android)
  const intro = product.introPrice;
  if (intro) {
    if (intro.price === 0) {
      const isWeekOr7D =
        (intro.periodUnit === 'DAY' && intro.periodNumberOfUnits === 7) ||
        (intro.periodUnit === 'WEEK' && intro.periodNumberOfUnits === 1) ||
        intro.period === 'P7D' ||
        intro.period === 'P1W';
      const label = isWeekOr7D
        ? `7-day free trial, then ${base}`
        : `${intro.periodNumberOfUnits || 7}-${String(intro.periodUnit || 'day').toLowerCase()} free trial, then ${base}`;
      return { hasTrial: true, trialLine: label };
    }
    // If intro has a price > 0, it is a paid introductory promo, not a free trial.
    return { hasTrial: false, trialLine: null };
  }

  // If defaultOption was provided by Google Play but has no free phase, there is no trial.
  if (defaultOpt) {
    return { hasTrial: false, trialLine: null };
  }

  // 3. Guaranteed Play Store trial fallback for configured DuoOrb packages when phase data is unavailable
  if (pkg.identifier === '$rc_monthly' || pkg.identifier === '$rc_annual') {
    return { hasTrial: true, trialLine: `7-day free trial, then ${base}` };
  }

  return { hasTrial: false, trialLine: null };
}

function planFromPackage(
  id: PlanId,
  title: string,
  featured: boolean,
  pkg: PurchasesPackage
): PremiumPlan {
  const product = pkg.product;
  const intro = product.introPrice;
  const base =
    id === 'monthly' ? `${product.priceString}/mo` : `${product.priceString}/yr`;

  const { hasTrial, trialLine } = detectFreeTrial(pkg);

  const priceLine =
    !hasTrial && intro && intro.price > 0
      ? `${intro.priceString} ${intro.period} intro, then ${base}`
      : base;

  return { id, title, priceLine, trialLine, featured, rcPackage: pkg };
}

export async function getPremiumPlans(): Promise<OffersResult> {
  try {
    await ensureConfigured();
    const offerings = await Purchases.getOfferings();
    const offering =
      offerings.all[OFFERING_ID] ?? offerings.current ?? undefined;
    const monthly = offering?.availablePackages.find(
      (p) => p.identifier === '$rc_monthly'
    );
    const yearly = offering?.availablePackages.find(
      (p) => p.identifier === '$rc_annual'
    );
    if (!monthly || !yearly) throw codedError('no-products', 'No products yet.');
    return {
      plans: [
        planFromPackage('monthly', 'Monthly', false, monthly),
        planFromPackage('yearly', 'Yearly', true, yearly),
      ],
      purchaseAvailable: true,
    };
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    const reason =
      code === 'not-configured'
        ? ('no-key' as const)
        : code === 'no-products'
          ? ('no-products' as const)
          : ('store-error' as const);
    return { plans: FALLBACK_PLANS, purchaseAvailable: false, reason };
  }
}

export type PurchaseOutcome =
  | { status: 'done' }
  | { status: 'cancelled' }
  | { status: 'needs-link' }
  | { status: 'error'; code: string; message: string };

/** Guests must link Google first — entitlements key to linked accounts (P2.4). */
export function purchaseNeedsLink(): boolean {
  return getIdentity()?.isGuest === true;
}

export async function purchasePlan(plan: PremiumPlan): Promise<PurchaseOutcome> {
  if (purchaseNeedsLink()) return { status: 'needs-link' };
  if (!plan.rcPackage) {
    return {
      status: 'error',
      code: 'not-configured',
      message: 'Purchases are not available yet.',
    };
  }
  try {
    await ensureConfigured();
    const result = await Purchases.purchasePackage(plan.rcPackage);
    let customerInfo = result?.customerInfo;
    let entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

    // On Android (specifically Google Play Sandbox), token validation with RevenueCat
    // can take 1-3 seconds. If not immediately present in customerInfo.entitlements.active:
    if (!entitlement) {
      const hasActiveSub =
        (Array.isArray(customerInfo?.activeSubscriptions) && customerInfo.activeSubscriptions.length > 0) ||
        (Array.isArray(customerInfo?.allPurchasedProductIdentifiers) &&
          customerInfo.allPurchasedProductIdentifiers.length > 0);

      // Poll getCustomerInfo() with cache invalidation to give server token validation time to complete
      for (let attempt = 0; attempt < 2 && !entitlement; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          if (typeof (Purchases as any).invalidateCustomerInfoCache === 'function') {
            await (Purchases as any).invalidateCustomerInfoCache();
          }
          if (typeof Purchases.getCustomerInfo === 'function') {
            customerInfo = await Purchases.getCustomerInfo();
            entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
          }
        } catch {
          // Retry
        }
      }

      // If still missing from entitlements map but store receipt confirmed the subscription:
      if (!entitlement && hasActiveSub) {
        recordLocalPurchase(customerInfo?.latestExpirationDate ?? null);
        track('purchase_completed', { plan: plan.id });
        if (plan.trialLine) track('trial_started', { plan: plan.id });
        void syncPremiumAfterPurchase();
        return { status: 'done' };
      }
    }

    if (entitlement) {
      // Store truth lands before the server webhook. Protect with local purchase grace
      // so early /me polling does not overwrite isPremium back to false.
      recordLocalPurchase(entitlement.expirationDate ?? null);
      track('purchase_completed', { plan: plan.id });
      if (plan.trialLine) track('trial_started', { plan: plan.id });
      void syncPremiumAfterPurchase();
      return { status: 'done' };
    }

    // Always schedule background sync so server webhook reconciles client state
    void syncPremiumAfterPurchase();

    // Check if the backend webhook has already landed
    try {
      const serverState = await refreshPremium();
      if (serverState.isPremium) {
        track('purchase_completed', { plan: plan.id });
        return { status: 'done' };
      }
    } catch {
      // Best-effort check
    }

    return {
      status: 'error',
      code: 'not-entitled',
      message: 'Purchase went through but Premium is not active yet. Try Restore.',
    };
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown; userCancelled?: boolean };
    const code = String(err?.code ?? '');
    const message = String(err?.message ?? 'Purchase failed.');
    if (err?.userCancelled || /cancel|cancelled|user_cancelled/i.test(code + message)) {
      return { status: 'cancelled' };
    }

    // Handle ITEM_ALREADY_OWNED / PRODUCT_ALREADY_PURCHASED_ERROR (Google Play error code 7 / RC code 6)
    const isAlreadyPurchased =
      code === 'PRODUCT_ALREADY_PURCHASED_ERROR' ||
      /already_purchased|already_owned|already owned|already subscribed|item_already_owned/i.test(
        code + message
      );

    if (isAlreadyPurchased) {
      try {
        const restoreOutcome = await restorePremium();
        if (restoreOutcome.status === 'done') {
          return { status: 'done' };
        }
      } catch {
        // Fall through to error
      }
    }

    track('purchase_failed', { plan: plan.id, code });
    return { status: 'error', code: code || 'unknown', message };
  }
}

export async function restorePremium(): Promise<PurchaseOutcome> {
  if (purchaseNeedsLink()) return { status: 'needs-link' };
  try {
    await ensureConfigured();
    let customerInfo = await Purchases.restorePurchases();
    let entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

    if (!entitlement) {
      const hasActiveSub =
        (Array.isArray(customerInfo?.activeSubscriptions) && customerInfo.activeSubscriptions.length > 0) ||
        (Array.isArray(customerInfo?.allPurchasedProductIdentifiers) &&
          customerInfo.allPurchasedProductIdentifiers.length > 0);

      if (hasActiveSub) {
        try {
          if (typeof (Purchases as any).invalidateCustomerInfoCache === 'function') {
            await (Purchases as any).invalidateCustomerInfoCache();
          }
          if (typeof Purchases.getCustomerInfo === 'function') {
            customerInfo = await Purchases.getCustomerInfo();
            entitlement = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
          }
        } catch {
          // Retry
        }
      }
    }

    if (entitlement) {
      recordLocalPurchase(entitlement.expirationDate ?? null);
      track('restored', {});
      void syncPremiumAfterPurchase();
      return { status: 'done' };
    }

    // Store has an active subscription even if entitlement map is delayed
    const hasActiveStoreSub =
      Array.isArray(customerInfo?.activeSubscriptions) && customerInfo.activeSubscriptions.length > 0;
    if (hasActiveStoreSub) {
      recordLocalPurchase(customerInfo?.latestExpirationDate ?? null);
      track('restored', {});
      void syncPremiumAfterPurchase();
      return { status: 'done' };
    }

    // Server fallback: check if server webhook already granted Premium
    try {
      const serverState = await refreshPremium();
      if (serverState.isPremium) {
        track('restored', {});
        return { status: 'done' };
      }
    } catch {
      // Best-effort check
    }

    return {
      status: 'error',
      code: 'nothing-to-restore',
      message: 'No Premium purchase found on this store account.',
    };
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown };
    try {
      const serverState = await refreshPremium();
      if (serverState.isPremium) {
        track('restored', {});
        return { status: 'done' };
      }
    } catch {
      // Best-effort check
    }
    return {
      status: 'error',
      code: String(err?.code ?? 'unknown'),
      message: String(err?.message ?? 'Restore failed.'),
    };
  }
}

function codedError(code: string, message: string): Error {
  const e = new Error(message) as Error & { code: string };
  e.code = code;
  return e;
}

/**
 * Post-purchase entitlement sync (M1): wait for webhook arrival lag before polling /me.
 * Never throws, never blocks the caller.
 */
async function syncPremiumAfterPurchase(): Promise<void> {
  // Give webhook time to hit server before querying /me
  await new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    await refreshPremium();
  } catch {
    // First sync is best-effort
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
  try {
    await refreshPremium();
  } catch {
    // Second sync is best-effort
  }
}

/** Test seam: reset SDK configuration state without touching the store. */
export function __resetOffersForTests(): void {
  configuredKey = null;
  configuredUser = null;
  listenerRegistered = false;
}
