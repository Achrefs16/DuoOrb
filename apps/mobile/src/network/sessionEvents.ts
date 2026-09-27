/**
 * Which session transition a Supabase auth event means, decided purely.
 *
 * This exists because of a startup race that flashed the onboarding screen
 * on every reopen: `onAuthStateChange` emits `INITIAL_SESSION` (with a null
 * session for guests) at subscribe time, while the boot effect is still
 * awaiting the guest refresh. Treating that emission as a sign-out wiped the
 * just-hydrated identity and flipped the app to `anonymous` for a frame,
 * until the refresh landed and flipped it back to `ready`. If the refresh
 * then failed, the wipe had already destroyed a healthy persisted session.
 *
 * The rule: the boot effect owns initial state. Only genuine transitions —
 * a real sign-in, a real sign-out, a token rotation — may touch the session.
 */
export type AuthChangeAction =
  | { kind: 'ignore' }
  | {
      kind: 'signin';
      userId: string;
      accessToken: string;
      fullName: string | undefined;
    }
  | { kind: 'signout' }
  | { kind: 'refresh'; accessToken: string };

export interface AuthEventSession {
  userId: string;
  accessToken: string;
  fullName: string | undefined;
}

/**
 * @param event   the raw Supabase `AuthChangeEvent` string.
 * @param session the session that came with the event, if any.
 * @param hadAccount true when the canonical identity is currently a
 *                   signed-in account (not a guest, not absent).
 */
export function classifyAuthEvent(
  event: string,
  session: AuthEventSession | null,
  hadAccount: boolean
): AuthChangeAction {
  // Owned by the boot effect, which already read this exact state and is
  // restoring or reporting anonymous. Reacting here is what flashed
  // onboarding and could destroy a session that was still being restored.
  if (event === 'INITIAL_SESSION') return { kind: 'ignore' };

  if (event === 'SIGNED_IN' && session) {
    return {
      kind: 'signin',
      userId: session.userId,
      accessToken: session.accessToken,
      fullName: session.fullName,
    };
  }

  if (event === 'SIGNED_OUT') {
    // Only a transition OUT of an account clears anything. A null event
    // with no account behind it is just "still signed out" — wiping here
    // would nuke a guest identity the event knows nothing about.
    return hadAccount ? { kind: 'signout' } : { kind: 'ignore' };
  }

  if (event === 'TOKEN_REFRESHED' && session) {
    // The account credential rotated. The stored token must follow it or
    // the socket and API keep presenting the expired one.
    return { kind: 'refresh', accessToken: session.accessToken };
  }

  // USER_UPDATED, PASSWORD_RECOVERY, MFA_CHALLENGE_VERIFIED and anything
  // future: the per-request token provider already reads the live Supabase
  // session, so no identity transition is needed.
  return { kind: 'ignore' };
}
