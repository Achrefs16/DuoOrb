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

/** Effective flag: a cached `true` past expiry reads as `false`. */
export function isPremiumActive(s: PremiumState = current): boolean {
  if (!s.isPremium) return false;
  if (!s.premiumExpiresAt) return true;
  return new Date(s.premiumExpiresAt).getTime() > Date.now();
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
  return useSyncExternalStore(subscribe, () => current, () => current);
}

/** Test seam: drops in-memory state without touching disk. */
export function __resetPremiumForTests(): void {
  current = { ...EMPTY };
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
