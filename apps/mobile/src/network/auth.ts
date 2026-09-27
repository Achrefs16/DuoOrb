import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * THE canonical client-side identity. One object, one owner, one source of
 * truth for the whole app.
 *
 * Everything the app knows about "who am I" lives here and nowhere else:
 * the socket handshake, every API bearer token, seat resolution, the profile
 * and settings screens, friend search. There is deliberately no second copy
 * and no locally-invented fallback.
 *
 * `username` and `displayName` are ALWAYS the values the server returned from
 * `/api/me`. This module never generates a name, never derives one from the
 * user id, and never keeps a name the server has not confirmed. That is what
 * makes the profile screen, the settings screen and the friend list agree.
 */
export interface CanonicalIdentity {
  /** Server-issued id. Empty string is impossible: a null identity is null. */
  userId: string;
  /** Server-confirmed @handle. */
  username: string;
  /** Server-confirmed label opponents see. */
  displayName: string;
  /** Bearer for every request and the socket handshake. */
  accessToken: string;
  /** Opaque token that mints the next access token. Guests only. */
  refreshToken: string | null;
  /** True when this identity was minted by `POST /api/guest`. */
  isGuest: boolean;
}

/**
 * The whole identity is persisted as ONE JSON document under ONE key.
 *
 * The previous layout spread it across five keys behind a `localStorage`
 * shim whose native branch was a no-op reader, so every read returned `null`
 * on Android. Splitting one object across several keys is also what allowed
 * half-written identities on disk after a kill. One key, one atomic write,
 * one read: there is no ordering to get wrong and nothing to reconcile.
 */
const IDENTITY_STORAGE_KEY = '@duoorb:identity:v2';

/** Bumped when the persisted shape changes incompatibly. */
const IDENTITY_SCHEMA_VERSION = 2;

interface PersistedIdentity {
  v: number;
  userId: string;
  username: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  isGuest: boolean;
}

/* -------------------------------------------------------------------------- */
/* Storage: one implementation, real persistence on both platforms            */
/* -------------------------------------------------------------------------- */

function hasWebStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function isValidPersisted(value: unknown): value is PersistedIdentity {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PersistedIdentity>;
  return (
    v.v === IDENTITY_SCHEMA_VERSION &&
    typeof v.userId === 'string' &&
    v.userId.length > 0 &&
    typeof v.username === 'string' &&
    typeof v.displayName === 'string' &&
    typeof v.accessToken === 'string' &&
    typeof v.isGuest === 'boolean' &&
    (v.refreshToken === null || typeof v.refreshToken === 'string')
  );
}

/**
 * Serializes every persistence operation. AsyncStorage gives no ordering
 * guarantee between independent `setItem` calls, and a kill mid-write used to
 * leave a stale id next to a fresh token.
 */
let writeChain: Promise<void> = Promise.resolve();
function enqueueWrite(op: () => Promise<unknown>): void {
  writeChain = writeChain.then(op, op).then(
    () => undefined,
    () => undefined
  );
}

async function readPersisted(): Promise<PersistedIdentity | null> {
  try {
    const raw = hasWebStorage()
      ? window.localStorage.getItem(IDENTITY_STORAGE_KEY)
      : await AsyncStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPersisted(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function writePersisted(value: PersistedIdentity): Promise<void> {
  const raw = JSON.stringify(value);
  enqueueWrite(async () => {
    if (hasWebStorage()) window.localStorage.setItem(IDENTITY_STORAGE_KEY, raw);
    else await AsyncStorage.setItem(IDENTITY_STORAGE_KEY, raw);
  });
}

async function removePersisted(): Promise<void> {
  enqueueWrite(async () => {
    if (hasWebStorage()) window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
    else await AsyncStorage.removeItem(IDENTITY_STORAGE_KEY);
  });
}

/** Resolves once every queued persistence write has landed. */
export function flushIdentityStorage(): Promise<void> {
  return writeChain;
}

/* -------------------------------------------------------------------------- */
/* The store                                                                  */
/* -------------------------------------------------------------------------- */

let current: CanonicalIdentity | null = null;
let hydrated = false;
let hydratePromise: Promise<CanonicalIdentity | null> | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // A subscriber must never break identity propagation.
    }
  }
}

function toCanonical(p: PersistedIdentity): CanonicalIdentity {
  return {
    userId: p.userId,
    username: p.username,
    displayName: p.displayName,
    accessToken: p.accessToken,
    refreshToken: p.refreshToken,
    isGuest: p.isGuest,
  };
}

function toPersisted(i: CanonicalIdentity): PersistedIdentity {
  return {
    v: IDENTITY_SCHEMA_VERSION,
    userId: i.userId,
    username: i.username,
    displayName: i.displayName,
    accessToken: i.accessToken,
    refreshToken: i.refreshToken,
    isGuest: i.isGuest,
  };
}

/**
 * Loads the persisted identity into memory. Idempotent and safe to call from
 * several places: the first call does the work, the rest await it.
 *
 * MUST complete before anything reads the identity. Every consumer either
 * awaits this or renders behind a gate that waits for it — that ordering is
 * what stops the app from acting on a half-known identity.
 */
export function hydrateIdentity(): Promise<CanonicalIdentity | null> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const persisted = await readPersisted();
    if (persisted) current = toCanonical(persisted);
    hydrated = true;
    return current;
  })();
  return hydratePromise;
}

/** True once `hydrateIdentity()` has settled. */
export function isIdentityHydrated(): boolean {
  return hydrated;
}

/**
 * The live canonical identity, or null when this device has no session.
 *
 * Always reads the current store value — it is never a snapshot of an
 * earlier moment. Non-React callers (socket, api client) use this; React
 * components use `useIdentity()` so they re-render on change.
 */
export function getIdentity(): CanonicalIdentity | null {
  return current;
}

/** The live access token, or an empty string when there is no session. */
export function getAccessTokenSync(): string {
  return current?.accessToken ?? '';
}

/** The live refresh token, or null. Reads memory, so it works on Android. */
export function getRefreshToken(): string | null {
  return current?.refreshToken ?? null;
}

/**
 * Installs a new canonical identity and persists it.
 *
 * This is the ONLY way an identity is created or replaced. Every path
 * (guest creation, guest refresh, account sign-in, sign-out) goes through
 * here, so there is exactly one code path that can change who the app is.
 */
export function setIdentity(next: CanonicalIdentity): CanonicalIdentity {
  if (!next.userId) {
    throw new Error('setIdentity requires a server-issued userId.');
  }
  current = next;
  void writePersisted(toPersisted(next));
  emit();
  return next;
}

/**
 * Patches the current identity. A no-op when there is no session, so a late
 * profile response can never resurrect a cleared identity.
 */
export function patchIdentity(patch: Partial<CanonicalIdentity>): CanonicalIdentity | null {
  if (!current) return null;
  const next: CanonicalIdentity = { ...current, ...patch };
  if (
    next.userId === current.userId &&
    next.username === current.username &&
    next.displayName === current.displayName &&
    next.accessToken === current.accessToken &&
    next.refreshToken === current.refreshToken &&
    next.isGuest === current.isGuest
  ) {
    return current;
  }
  current = next;
  void writePersisted(toPersisted(next));
  emit();
  return next;
}

/**
 * Records the server-confirmed profile. This is the ONLY way names enter the
 * client, so the profile screen, the settings screen, the socket handshake
 * and the seat all read one server-owned value.
 */
export function applyServerProfile(profile: {
  username?: string | null;
  displayName?: string | null;
}): CanonicalIdentity | null {
  const patch: Partial<CanonicalIdentity> = {};
  if (typeof profile.username === 'string' && profile.username.trim()) {
    patch.username = profile.username.trim();
  }
  if (typeof profile.displayName === 'string' && profile.displayName.trim()) {
    patch.displayName = profile.displayName.trim().slice(0, 24);
  }
  return patchIdentity(patch);
}

/** Forgets the session locally. The caller decides whether to create one. */
export function clearIdentity(): void {
  current = null;
  void removePersisted();
  emit();
}

/** Replaces the token pair after a rotation, keeping the same account. */
export function updateIdentityTokens(accessToken: string, refreshToken: string | null): void {
  patchIdentity({ accessToken, refreshToken });
}

/* -------------------------------------------------------------------------- */
/* React binding                                                              */
/* -------------------------------------------------------------------------- */

/** Subscribe to identity changes. Returns an unsubscribe function. */
export function subscribeIdentity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * The canonical identity, kept live across renders.
 *
 * This is the only sanctioned way for a component to learn who the user is.
 * Reading the store directly inside a component body captures a value that
 * goes stale the moment the session changes — which is exactly how a player
 * ended up seated under one id while the UI believed in another.
 */
export function useIdentity(): CanonicalIdentity | null {
  return useSyncExternalStore(subscribeIdentity, getIdentity, getIdentity);
}

/** Test seam: drops in-memory state without touching disk. */
export function __resetIdentityForTests(): void {
  current = null;
  hydrated = false;
  hydratePromise = null;
  listeners.clear();
  writeChain = Promise.resolve();
}
