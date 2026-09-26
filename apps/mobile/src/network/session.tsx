import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { User } from '../lib/supabase';
import { getSupabaseAuth, isSupabaseConfigured } from '../lib/supabase';
import {
  getCurrentUser,
  adoptAccountIdentity,
  resetToNewGuest,
  cacheProfile,
  getStoredRefreshToken,
  setGuestCredentials,
  clearGuestCredentials,
} from './auth';
import { socketManager } from './socket';
import {
  api,
  ApiError,
  setTokenProvider,
  createGuestSession,
  refreshGuestSession,
} from './apiClient';
import { clearOnboarding } from '../storage/onboarding';

WebBrowser.maybeCompleteAuthSession();

const MERGE_KEY_PREFIX = '@duoorb:auth:merged-guest:';

function readMergeRecord(guestId: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(MERGE_KEY_PREFIX + guestId);
    }
  } catch {
    // ignore
  }
  return null;
}

function writeMergeRecord(guestId: string, accountId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(MERGE_KEY_PREFIX + guestId, accountId);
    }
  } catch {
    // ignore
  }
}

export interface Identity {
  userId: string;
  displayName: string;
  /** Public @handle, present for signed-in players once /me has loaded. */
  username?: string;
  email?: string;
  isGuest: boolean;
}

export interface SessionProfile {
  username: string;
  displayName: string;
}

interface SessionContextValue {
  identity: Identity;
  /** Server profile (username + display name), null for guests or before load. */
  profile: SessionProfile | null;
  /** False while the initial /me fetch is still in flight. */
  profileLoading: boolean;
  supabaseUser: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** Re-pulls /me and refreshes identity; call after editing the profile. */
  refreshProfile: () => Promise<boolean>;
  /**
   * Ensures guest credentials exist (minting or rotating them). The welcome
   * screen calls this before letting a player continue as a guest.
   */
  ensureGuestSession: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Server-owned identity (username + display name). Kept in state so an edit
  // re-renders every consumer, and mirrored into the local identity cache so
  // the socket handshake, room slots and seats pick it up immediately.
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const guest = useMemo(() => getCurrentUser(), []);
  const accountId = supabaseUser?.id;

  // Push the current credential into the socket layer whenever the session
  // changes, reconnecting if already connected. Signed-in players present
  // their Supabase JWT; guests present their server-issued access token —
  // pushing null for guests used to leave live sockets holding a stale or
  // empty token forever.
  const pushTokenToSocket = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await getSupabaseAuth().getSession();
      socketManager.updateAuthToken(
        data.session?.access_token || getCurrentUser().token || null
      );
    } catch {
      socketManager.updateAuthToken(getCurrentUser().token || null);
    }
  }, []);

  /**
   * Makes sure a guest holds credentials the server actually issued.
   *
   * Three cases: a live refresh token mints a new access token; a dead one
   * (expired, revoked, rate-limited) is dropped and a brand-new identity is
   * minted so the device can never wedge itself retrying the same token;
   * with nothing stored, a first identity is requested. There is no
   * locally-generated fallback — the server would reject it.
   */
  const ensureGuestSession = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    const stored = getStoredRefreshToken();
    if (stored) {
      try {
        setGuestCredentials(await refreshGuestSession(stored));
        return true;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearGuestCredentials();
        } else {
          setError('Could not reach the server. Check your connection and try again.');
          return false;
        }
      }
    }
    try {
      setGuestCredentials(await createGuestSession());
      return true;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Check your connection and try again.'
      );
      return false;
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isSupabaseConfigured) return null;
    try {
      const { data } = await getSupabaseAuth().getSession();
      return data.session?.access_token ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured) {
        try {
          const { data } = await getSupabaseAuth().getSession();
          if (!cancelled) setSupabaseUser(data.session?.user ?? null);
        } catch {
          // offline on first launch — guest mode
        }
      }
      // A guest needs server-issued credentials before the socket handshake or
      // any API call, so mint (or rotate) them first.
      if (!(await ensureGuestSession()) && !cancelled) {
        setError('Could not reach the server. Check your connection and try again.');
      }
      if (!cancelled) setLoading(false);
      await pushTokenToSocket();
    })();

    if (!isSupabaseConfigured) return undefined;
    const { data: listener } = getSupabaseAuth().onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setSupabaseUser(session?.user ?? null);
      if (session?.user) {
        // Migrate live state on the CURRENT socket first (server moves
        // rooms/seats/queue guest -> account), then adopt the account id
        // locally. If migration fails we stay guest: safe, never split.
        const token = session.access_token ?? (await getAccessToken());
        if (token) {
          const moved = await socketManager.adoptSession(token);
          if (moved && !cancelled) adoptAccountIdentity(session.user.id);
        }
      } else {
        writeMergeRecord(guest.userId, 'signed-out');
      }
      await pushTokenToSocket();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [guest.userId, pushTokenToSocket, getAccessToken, ensureGuestSession]);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Sign-in is not configured on this build.');
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      // WEB: full-page redirect back to our origin (popups + custom schemes
      // cannot complete on desktop browsers). The client restores the
      // session from the returning URL automatically.
      if (Platform.OS === 'web') {
        const siteUrl =
          typeof window !== 'undefined' && window.location?.origin
            ? window.location.origin
            : undefined;
        const { error: oauthError } = await getSupabaseAuth().signInWithOAuth({
          provider: 'google',
          options: siteUrl ? { redirectTo: siteUrl } : {},
        });
        if (oauthError) throw oauthError;
        return;
      }
      // NATIVE: PKCE via system browser, then explicit code exchange.
      const redirectTo = makeRedirectUri({ scheme: 'duoorb', path: 'auth/callback' });
      const { data, error: oauthError } = await getSupabaseAuth().signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No OAuth URL returned.');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== 'success' || !res.url) {
        if (res.type !== 'cancel' && res.type !== 'dismiss') {
          throw new Error('Sign-in was interrupted.');
        }
        return;
      }
      const code = new URL(res.url).searchParams.get('code');
      if (!code) throw new Error('Sign-in completed without a code.');
      const { error: exchangeError } = await getSupabaseAuth().exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
    } catch (e: any) {
      setError(e?.message ?? 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      if (isSupabaseConfigured) await getSupabaseAuth().signOut();
    } finally {
      setProfile(null);
      // An explicit sign-out is a clean first run on this device, so the
      // welcome + username flow is offered again next launch.
      void clearOnboarding();
      resetToNewGuest();
      // resetToNewGuest dropped the credentials, so the socket has nothing to
      // present until a new guest is minted.
      await ensureGuestSession();
      await pushTokenToSocket();
      socketManager.refreshIdentity(getCurrentUser().userId);
    }
  }, [ensureGuestSession, pushTokenToSocket]);

  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  /**
   * One-shot guest merge, run automatically on sign-in. Silent by design:
   * a background retry must not surface an error toast, so failures only
   * schedule another attempt.
   */
  const mergeGuestProgress = useCallback(async (): Promise<boolean> => {
    try {
      const token = await getAccessToken();
      if (!token) return false;
      const base = process.env.EXPO_PUBLIC_SERVER_URL;
      if (!base) return false;
      const res = await fetch(`${base}/api/users/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ guestId: guest.userId }),
      });
      if (!res.ok) return false;
      writeMergeRecord(guest.userId, accountId ?? 'account');
      return true;
    } catch {
      return false;
    }
  }, [getAccessToken, guest.userId, accountId]);

  /**
   * Guest progress is carried into the account with no prompt: the player
   * signs in to keep playing, so keeping their rating, friends and history is
   * the expected behaviour. A marker is written once per guest so this runs
   * a single time, and a failed attempt (offline, server down) is retried
   * quietly until it succeeds.
   */
  useEffect(() => {
    if (!supabaseUser) return undefined;
    if (readMergeRecord(guest.userId)) return undefined;

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const attempt = async () => {
      const merged = await mergeGuestProgress();
      if (cancelled || merged) return;
      retry = setTimeout(() => void attempt(), 5000);
    };
    void attempt();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [supabaseUser, guest.userId, mergeGuestProgress]);

  /**
   * Fetches the server profile and mirrors it into the local identity cache
   * (so the socket handshake, room slots and seats pick it up).
   *
   * Works for guests too: the API client falls back to the local dev token,
   * so a guest gets a real server profile with a generated `player_xxxxxx`
   * handle that can be renamed just like a signed-in account. Returns null
   * when the request fails — callers keep whatever they had.
   */
  const loadProfile = useCallback(async (): Promise<SessionProfile | null> => {
    try {
      const me = await api.getMe();
      const next: SessionProfile = {
        username: me.username,
        displayName: me.displayName,
      };
      cacheProfile(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  /** Re-reads /me and pushes it into session state. True on success. */
  const refreshProfile = useCallback(async (): Promise<boolean> => {
    setProfileLoading(true);
    try {
      const next = await loadProfile();
      if (!next) return false;
      setProfile(next);
      return true;
    } finally {
      setProfileLoading(false);
    }
  }, [loadProfile]);

  // Initial load. The setState lives in the promise callback, so the effect
  // itself never triggers a cascading render.
  useEffect(() => {
    let cancelled = false;
    void loadProfile().then((next) => {
      if (!cancelled && next) setProfile(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loadProfile]);

  const identity: Identity = supabaseUser
    ? {
        userId: supabaseUser.id,
        // The chosen display name wins over the identity provider's, since
        // that is what the player sees in matches and what others see.
        displayName:
          profile?.displayName ??
          (supabaseUser.user_metadata?.full_name as string | undefined) ??
          supabaseUser.email ??
          'Player',
        username: profile?.username,
        email: supabaseUser.email,
        isGuest: false,
      }
    : {
        userId: guest.userId,
        // Guests get the same editable identity, just without an email.
        displayName: profile?.displayName ?? guest.displayName,
        username: profile?.username ?? guest.username,
        isGuest: true,
      };

  const value: SessionContextValue = {
    identity,
    profile,
    profileLoading,
    supabaseUser,
    loading,
    signingIn,
    error,
    signInWithGoogle,
    signOut,
    getAccessToken,
    refreshProfile,
    ensureGuestSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider.');
  return ctx;
}
