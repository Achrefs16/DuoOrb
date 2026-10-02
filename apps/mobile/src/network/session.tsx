import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import type { User } from '../lib/supabase';
import { getSupabaseAuth, isSupabaseConfigured } from '../lib/supabase';
import {
  applyServerProfile,
  clearIdentity,
  getIdentity,
  patchIdentity,
  setIdentity,
  useIdentity,
} from './auth';
import { classifyAuthEvent } from './sessionEvents';
import { socketManager } from './socket';
import { api, ApiError, setTokenProvider, createGuestSession, refreshGuestSession } from './apiClient';
import {
  createGuestIdentity,
  loadCanonicalProfile,
  restoreSession,
  ServerProfile,
} from './sessionRestore';
import { clearOnboarding } from '../storage/onboarding';

WebBrowser.maybeCompleteAuthSession();

/**
 * Session lifecycle.
 *
 * `restoring`  — recovering persisted credentials. Renders nothing.
 * `anonymous`  — no usable session. Onboarding (Welcome -> Username) is shown.
 * `ready`      — canonical identity installed, `/me` loaded, app may render.
 *
 * There is no path from `restoring` to `ready` that creates an account. Only
 * the Continue as Guest button can do that.
 */
export type SessionStatus = 'restoring' | 'anonymous' | 'ready';

export interface SessionProfile {
  username: string;
  displayName: string;
}

interface SessionContextValue {
  /** The one canonical identity. Null only while `anonymous`/`restoring`. */
  identity: ReturnType<typeof useIdentity>;
  profile: SessionProfile | null;
  profileLoading: boolean;
  status: SessionStatus;
  supabaseUser: User | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  /** Re-reads `/me` and folds it into the canonical identity. */
  refreshProfile: () => Promise<boolean>;
  /**
   * Creates a guest. EXCLUSIVELY called by the Continue as Guest button.
   * Concurrent calls share one in-flight request, so a double tap or a
   * remount mints exactly one account.
   */
  continueAsGuest: () => Promise<boolean>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const isDeadSessionError = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 401 || error.status === 403);

/**
 * Carries guest progress (rating, friends, history) into a freshly signed-in
 * account. Fire-and-forget: a failure must never block sign-in, and the merge
 * is one-shot server-side so a retry is harmless.
 */
async function linkGuestProgress(accessToken: string, guestId: string): Promise<void> {
  try {
    await api.linkGuest(guestId, accessToken);
  } catch {
    // Progress stays on the guest row; not worth surfacing.
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [status, setStatus] = useState<SessionStatus>('restoring');
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // The canonical identity, live. Every consumer in the app resolves the user
  // through this (directly or via useIdentity), so there is no second copy
  // that can drift.
  const identity = useIdentity();
  const [profile, setProfile] = useState<SessionProfile | null>(null);

  const fetchProfile = useCallback(async (accessToken: string): Promise<ServerProfile> => {
    // `getMe` sends its own Authorization header from the canonical store, so
    // the token argument is only used to assert the caller's intent.
    void accessToken;
    const me = await api.getMe();
    return { username: me.username, displayName: me.displayName };
  }, []);

  const applyProfileToState = useCallback((next: ServerProfile | null) => {
    if (!next) return;
    setProfile(next);
    // The canonical identity must carry the same server-confirmed names, or
    // every reader of identity.username (gates, Settings, seats) keeps the
    // empty handle the sign-in installed — e.g. Google accounts showed a
    // blank username everywhere despite the backend owning player_xxxxxx.
    applyServerProfile(next);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Boot: hydrate -> restore -> /me. Never creates an account.              */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabaseSession = isSupabaseConfigured
          ? (await getSupabaseAuth().getSession().catch(() => ({ data: { session: null } }))).data
              .session
          : null;

        if (cancelled) return;

        if (supabaseSession?.user) {
          // A signed-in account is authoritative; adopt it and load /me.
          setSupabaseUser(supabaseSession.user);
          setIdentity({
            userId: supabaseSession.user.id,
            username: '',
            displayName:
              (supabaseSession.user.user_metadata?.full_name as string | undefined) ?? 'Player',
            accessToken: supabaseSession.access_token,
            refreshToken: null,
            isGuest: false,
          });
          const next = await loadCanonicalProfile(supabaseSession.access_token, fetchProfile);
          if (cancelled) return;
          applyProfileToState(next ? { username: next.username, displayName: next.displayName } : null);
          if (!cancelled) setStatus('ready');
          return;
        }

        const outcome = await restoreSession({
          getStoredRefreshToken: () => getIdentity()?.refreshToken ?? null,
          refreshGuestSession,
          fetchProfile,
          isDeadSession: isDeadSessionError,
        });
        if (cancelled) return;

        if (outcome.status === 'restored') {
          applyProfileToState(
            outcome.profileLoaded
              ? { username: outcome.identity.username, displayName: outcome.identity.displayName }
              : null
          );
          setStatus('ready');
        } else {
          setStatus('anonymous');
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? 'Could not restore your session.');
        setStatus('anonymous');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchProfile, applyProfileToState]);

  /* ---------------------------------------------------------------------- */
  /* Token provider: always the CURRENT canonical identity.                  */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    setTokenProvider(async () => {
      const live = getIdentity();
      if (live?.isGuest) return live.accessToken;
      // Signed in: prefer the Supabase session, fall back to canonical.
      if (isSupabaseConfigured) {
        const { data } = await getSupabaseAuth().getSession().catch(() => ({ data: { session: null } }));
        if (data.session?.access_token) return data.session.access_token;
      }
      return live?.accessToken ?? null;
    });
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Account sign-in / sign-out.                                             */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const { data: listener } = getSupabaseAuth().onAuthStateChange(async (event, session) => {
      // Gate every emission through the event classifier. The boot effect
      // owns the subscription-time INITIAL_SESSION; reacting to it here used
      // to read "no Supabase session (yet)" as a sign-out, wiping the
      // persisted guest identity and flashing onboarding on every reopen
      // while the restore was still in flight.
      const action = classifyAuthEvent(
        event,
        session?.user
          ? {
              userId: session.user.id,
              accessToken: session.access_token,
              fullName: session.user.user_metadata?.full_name as string | undefined,
            }
          : null,
        getIdentity()?.isGuest === false
      );
      if (action.kind === 'ignore') return;

      if (action.kind === 'refresh') {
        // The account credential rotated. Follow it in the store so the
        // socket (which rebuilds on token change) and the API stop
        // presenting the expired one.
        patchIdentity({ accessToken: action.accessToken });
        return;
      }

      if (action.kind === 'signin') {
        setSupabaseUser(session!.user);
        // Capture the guest id BEFORE the account replaces it, so guest
        // progress (rating, friends, history) can be merged into the account.
        const previous = getIdentity();
        const mergingGuest =
          previous?.isGuest === true && previous.userId !== action.userId
            ? previous.userId
            : null;

        setIdentity({
          userId: action.userId,
          username: '',
          displayName: action.fullName ?? 'Player',
          accessToken: action.accessToken,
          refreshToken: null,
          isGuest: false,
        });
        // The socket observes identity changes itself and rebuilds with the
        // account credential, then migrates live rooms/seats/queue.
        socketManager.adoptSession(action.accessToken);
        if (mergingGuest) void linkGuestProgress(action.accessToken, mergingGuest);

        const next = await loadCanonicalProfile(action.accessToken, fetchProfile);
        if (next) {
          applyProfileToState({ username: next.username, displayName: next.displayName });
        }
        setStatus('ready');
        return;
      }

      // signout: forget everything. The next Continue as Guest press mints a
      // new identity — never silently, never at boot.
      setSupabaseUser(null);
      clearIdentity();
      setProfile(null);
      void clearOnboarding();
      setStatus('anonymous');
    });
    return () => listener.subscription.unsubscribe();
  }, [fetchProfile, applyProfileToState]);

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('Sign-in is not configured on this build.');
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
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
      clearIdentity();
      socketManager.disconnect();
      setProfile(null);
      void clearOnboarding();
      setStatus('anonymous');
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Continue as Guest: the ONLY account-creation path.                      */
  /* ---------------------------------------------------------------------- */
  const guestCreateInFlight = useRef<Promise<boolean> | null>(null);

  const continueAsGuest = useCallback(async (): Promise<boolean> => {
    if (guestCreateInFlight.current) return guestCreateInFlight.current;

    const run = async (): Promise<boolean> => {
      setError(null);
      try {
        const result = await createGuestIdentity({ fetchProfile }, createGuestSession);
        if (!result.ok) return false;
        applyProfileToState({
          username: result.identity.username,
          displayName: result.identity.displayName,
        });
        setStatus('ready');
        return true;
      } catch (e: any) {
        setError(
          e instanceof ApiError
            ? e.message
            : 'Could not reach the server. Check your connection and try again.'
        );
        return false;
      }
    };

    guestCreateInFlight.current = run().finally(() => {
      guestCreateInFlight.current = null;
    });
    return guestCreateInFlight.current;
  }, [fetchProfile, applyProfileToState]);

  /** Re-reads `/me` and folds the result into the canonical identity. */
  const refreshProfile = useCallback(async (): Promise<boolean> => {
    setProfileLoading(true);
    try {
      const live = getIdentity();
      if (!live) return false;
      const next = await loadCanonicalProfile(live.accessToken, fetchProfile);
      if (!next) return false;
      applyProfileToState({ username: next.username, displayName: next.displayName });
      return true;
    } catch {
      return false;
    } finally {
      setProfileLoading(false);
    }
  }, [fetchProfile, applyProfileToState]);

  const value: SessionContextValue = {
    identity,
    profile,
    profileLoading,
    status,
    supabaseUser,
    loading: status === 'restoring',
    signingIn,
    error,
    signInWithGoogle,
    signOut,
    getAccessToken: async () => {
      const live = getIdentity();
      return live?.accessToken ?? null;
    },
    refreshProfile,
    continueAsGuest,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider.');
  return ctx;
}
