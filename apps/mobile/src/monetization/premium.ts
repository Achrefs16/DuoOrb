import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../network/apiClient';

/**
 * Client-side premium entitlement (MONETIZATION.md P2).
 *
 * The SERVER is the source of truth (`Profile.isPremium`, written only by
 * verified RevenueCat webhooks). This module is a live view over it:
 * - `ingestMe()` folds every `/me` response into state — called from the
 *   session's `fetchProfile`, so boot, sign-in and refresh all sync for free.
 * - `refreshPremium()` re-reads `/me` on demand (post-purchase, foreground).
 * - AsyncStorage cache (`@duoorb:premium:v1`) covers offline boot; a cached
 *   `true` past its `premiumExpiresAt` reads as `false` (client backstop —
 *   the server re-decides on every /me).
 * - RevenueCat SDK wiring (configure/purchase/restore) lands here in P2.2b
 *   once the P0.5 public key exists; gates already work without it.
 */

export interface PremiumState {
  isPremium: boolean;
  premiumExpiresAt: string | null;
  loading: boolean;
  syncedAt: number | null;
}

export interface PremiumMe {
  isPremium?: boolean | null;
  premiumExpiresAt?: string | number | null;
}

const PREMIUM_CACHE_KEY = '@duoorb:premium:v1';
const DEV_PREMIUM_KEY = '@duoorb:dev_premium_override';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
export const isDevEnvironment = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);

/**
 * Developer override: defaults to null (disabled) so the app tests with real
 * Google Play / RevenueCat subscriptions and actual free tier limits.
 */
let devOverride: boolean | null = null;

export function setDevPremiumOverride(enabled: boolean | null): void {
  devOverride = enabled;
  current = { ...current };
  if (enabled === null) {
    void AsyncStorage.removeItem(DEV_PREMIUM_KEY).catch(() => {});
  } else {
    void AsyncStorage.setItem(DEV_PREMIUM_KEY, enabled ? 'true' : 'false').catch(() => {});
  }
  emit();
}

export function getDevPremiumOverride(): boolean | null {
  return devOverride;
}

/** Normal offline trust window for a server-confirmed entitlement. */
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard ceiling on how long a cached paid window is trusted without /me. */
const MAX_OFFLINE_EXPIRY_TRUST_MS = 35 * 24 * 60 * 60 * 1000;

const EMPTY: PremiumState = {
  isPremium: false,
  premiumExpiresAt: null,
  loading: true,
  syncedAt: null,
};

let current: PremiumState = { ...EMPTY };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribePremium(fn: () => void): () => void {
  return subscribe(fn);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function coerce(me: PremiumMe): Pick<PremiumState, 'isPremium' | 'premiumExpiresAt'> {
  const rawExpiry =
    typeof me.premiumExpiresAt === 'number'
      ? new Date(me.premiumExpiresAt).toISOString()
      : (me.premiumExpiresAt ?? null);
  return { isPremium: me.isPremium === true, premiumExpiresAt: rawExpiry };
}

/**
 * Effective flag: a cached `true` past expiry reads as `false`.
 *
 * Offline trust is deliberately bounded: an explicit future expiry is good
 * for at most 35 days after the last successful `/me`, while a lifetime /
 * no-expiry entitlement survives 7 days. This keeps a stolen cache from
 * granting Premium forever without ever re-checking the server.
 */
export function isPremiumActive(s: PremiumState = current): boolean {
  if (devOverride !== null) return devOverride;
  if (!s.isPremium) return false;
  const now = Date.now();
  if (s.premiumExpiresAt) {
    const until = Date.parse(s.premiumExpiresAt);
    if (!Number.isFinite(until) || until <= now) return false;
  }
  if (s.syncedAt != null) {
    const age = now - s.syncedAt;
    if (age > MAX_OFFLINE_EXPIRY_TRUST_MS) return false;
    if (!s.premiumExpiresAt && age > OFFLINE_GRACE_MS) return false;
  }
  // A legacy cache without syncedAt is trusted only while its explicit
  // expiry says so (never indefinitely for a missing expiry).
  if (s.syncedAt == null && !s.premiumExpiresAt) return false;
  return true;
}

/** Fold a `/me` response into state + cache. Never throws. */
export function ingestMe(me: PremiumMe): PremiumState {
  current = { ...coerce(me), loading: false, syncedAt: Date.now() };
  emit();
  void AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify(current)).catch(
    () => {}
  );
  return current;
}

/** Re-read `/me` now (post-purchase, foreground refresh). Keeps last state on error. */
export async function refreshPremium(): Promise<PremiumState> {
  try {
    const me = await api.getMe();
    return ingestMe(me);
  } catch {
    if (current.loading) {
      current = { ...current, loading: false };
      emit();
    }
    return current;
  }
}

/** Offline-boot fast path: cached state, expiry still enforced by isPremiumActive. */
export async function hydratePremiumCache(): Promise<PremiumState> {
  try {
    const devRaw = await AsyncStorage.getItem(DEV_PREMIUM_KEY);
    if (devRaw !== null) {
      devOverride = devRaw === 'true';
      current = { ...current };
    } else {
      devOverride = null;
    }
  } catch {
    // ignore
  }

  try {
    const raw = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PremiumState>;
      current = {
        isPremium: parsed.isPremium === true,
        premiumExpiresAt:
          typeof parsed.premiumExpiresAt === 'string' ? parsed.premiumExpiresAt : null,
        loading: false,
        syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : null,
      };
      emit();
    } else if (current.loading) {
      current = { ...current, loading: false };
      emit();
    }
  } catch {
    if (current.loading) {
      current = { ...current, loading: false };
      emit();
    }
  }
  return current;
}

/** Live premium state for gates, banners and badges. */
export function usePremium(): PremiumState {
  const state = useSyncExternalStore(subscribe, () => current, () => current);
  if (devOverride !== null) {
    return { ...state, isPremium: devOverride };
  }
  return state;
}

/** Test seam: drops in-memory state without touching disk. */
export function __resetPremiumForTests(): void {
  current = { ...EMPTY };
  devOverride = null;
  listeners.clear();
}

/**
 * Account exit (sign-out / session invalidation): forgets the entitlement in
 * memory AND on disk. The cache is not namespaced per account, so without
 * this the next account boots offline into the previous owner's tier. After
 * clearing, gates read free until the next /me — fail-closed by construction.
 */
export function clearPremium(): void {
  current = { ...EMPTY, loading: false };
  emit();
  void AsyncStorage.removeItem(PREMIUM_CACHE_KEY).catch(() => {});
}
