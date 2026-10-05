import Purchases from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';
import { getIdentity } from '../network/auth';
import { refreshPremium } from './premium';
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

async function ensureConfigured(): Promise<string> {
  const key = publicKey();
  if (!key) throw codedError('not-configured', 'Purchases not configured yet.');
  const identity = getIdentity();
  // RevenueCat App User ID = DuoOrb userId (server webhooks key off it).
  // Guests never reach here (guest guard below) — fall back safely anyway.
  const appUserID = identity?.userId ?? 'anonymous';
  if (configuredKey !== key) {
    // First configure per key (once per launch, normally).
    Purchases.configure({ apiKey: key, appUserID });
    configuredKey = key;
    configuredUser = appUserID;
  } else if (configuredUser !== appUserID) {
    // Account switch (sign-out/in, guest link): re-identifying RE-configures
    // the SDK and corrupts the customer mapping — logIn() is the switch path.
    await Purchases.logIn(appUserID);
    configuredUser = appUserID;
  }
  return appUserID;
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
  // Free trials surface as a 7-DAY intro period; paid promos (P0.8 $2.99 /
  // $19.99 windows) surface with their own price + ISO period instead.
  const isFreeWeekTrial =
    intro != null &&
    intro.price === 0 &&
    intro.periodUnit === 'DAY' &&
    intro.periodNumberOfUnits === 7;
  const priceLine = intro
    ? `${intro.priceString} ${intro.period} intro, then ${base}`
    : base;
  const trialLine = isFreeWeekTrial
    ? `7-day free trial, then ${base}`
    : intro
      ? `Intro offer: ${intro.priceString}, then ${base}`
      : null;
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
  } catch {
    return { plans: FALLBACK_PLANS, purchaseAvailable: false };
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
    const { customerInfo } = await Purchases.purchasePackage(plan.rcPackage);
    const active = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    if (active) {
      track('purchase_completed', { plan: plan.id });
      if (plan.trialLine) track('trial_started', { plan: plan.id });
      // M1: the webhook usually lands seconds AFTER the receipt validates.
      // Sync now (fast when it already landed) and once more after a beat —
      // fire-and-forget so the sheet closes instantly either way.
      void syncPremiumAfterPurchase();
      return { status: 'done' };
    }
    return {
      status: 'error',
      code: 'not-entitled',
      message: 'Purchase went through but Premium is not active yet. Try Restore.',
    };
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown };
    const code = String(err?.code ?? '');
    const message = String(err?.message ?? 'Purchase failed.');
    if (/cancel|cancelled|user_cancelled/i.test(code + message)) {
      return { status: 'cancelled' };
    }
    track('purchase_failed', { plan: plan.id, code });
    return { status: 'error', code: code || 'unknown', message };
  }
}

export async function restorePremium(): Promise<PurchaseOutcome> {
  if (purchaseNeedsLink()) return { status: 'needs-link' };
  try {
    await ensureConfigured();
    const customerInfo = await Purchases.restorePurchases();
    const active = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    if (active) {
      track('restored', {});
      void syncPremiumAfterPurchase();
      return { status: 'done' };
    }
    return {
      status: 'error',
      code: 'nothing-to-restore',
      message: 'No Premium purchase found on this store account.',
    };
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown };
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
 * Post-purchase entitlement sync (M1): refresh now, and once more after a
 * beat for the webhook lag. Never throws, never blocks the caller.
 */
const RESYNC_DELAY_MS = 8000;

async function syncPremiumAfterPurchase(): Promise<void> {
  try {
    await refreshPremium();
  } catch {
    // First sync is best-effort; the delayed pass decides nothing either —
    // every later /me reconciles anyway.
  }
  await new Promise((resolve) => setTimeout(resolve, RESYNC_DELAY_MS));
  try {
    await refreshPremium();
  } catch {
    // Same: silent. The next boot/refresh/foreground picks it up.
  }
}

/** Test seam: reset SDK configuration state without touching the store. */
export function __resetOffersForTests(): void {
  configuredKey = null;
  configuredUser = null;
}
