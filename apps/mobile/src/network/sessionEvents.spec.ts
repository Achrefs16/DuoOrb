import { describe, expect, it } from 'vitest';
import { classifyAuthEvent } from './sessionEvents';

/**
 * The auth-event gate that stops the onboarding flash.
 *
 * Regression context: on every reopen with a valid guest session, the
 * Supabase listener fired INITIAL_SESSION (null session) while the boot
 * effect was still refreshing the guest. The old handler treated any null
 * session as a sign-out, so the app went restoring -> anonymous (Welcome
 * flashes) -> ready. These tests pin the event ordering that must hold.
 */

const guestRestoreInFlight = { hadAccount: false };
const signedInAccount = { hadAccount: true };

const googleSession = {
  userId: 'acct-uuid',
  accessToken: 'supabase-jwt',
  fullName: 'Achraf',
};

describe('classifyAuthEvent', () => {
  it('ignores INITIAL_SESSION with no session while a guest restore is in flight', () => {
    // This exact emission used to wipe the hydrated identity and flash
    // onboarding on every single reopen.
    expect(classifyAuthEvent('INITIAL_SESSION', null, guestRestoreInFlight.hadAccount)).toEqual({
      kind: 'ignore',
    });
  });

  it('ignores INITIAL_SESSION even when it carries a session (boot owns it)', () => {
    expect(classifyAuthEvent('INITIAL_SESSION', googleSession, false)).toEqual({ kind: 'ignore' });
  });

  it('turns a real SIGNED_IN into the sign-in transition', () => {
    expect(classifyAuthEvent('SIGNED_IN', googleSession, false)).toEqual({
      kind: 'signin',
      userId: 'acct-uuid',
      accessToken: 'supabase-jwt',
      fullName: 'Achraf',
    });
  });

  it('ignores a SIGNED_IN with no session attached', () => {
    expect(classifyAuthEvent('SIGNED_IN', null, false)).toEqual({ kind: 'ignore' });
  });

  it('turns SIGNED_OUT after an account into the sign-out transition', () => {
    expect(classifyAuthEvent('SIGNED_OUT', null, signedInAccount.hadAccount)).toEqual({
      kind: 'signout',
    });
  });

  it('ignores SIGNED_OUT when there is no account to sign out of', () => {
    // A guest identity must never be destroyed by an event that knows
    // nothing about it. This also makes repeated sign-outs idempotent.
    expect(classifyAuthEvent('SIGNED_OUT', null, false)).toEqual({ kind: 'ignore' });
  });

  it('turns TOKEN_REFRESHED into a token rotation, never a re-login', () => {
    expect(
      classifyAuthEvent('TOKEN_REFRESHED', { ...googleSession, accessToken: 'rotated-jwt' }, true)
    ).toEqual({ kind: 'refresh', accessToken: 'rotated-jwt' });
  });

  it('ignores TOKEN_REFRESHED with no session', () => {
    expect(classifyAuthEvent('TOKEN_REFRESHED', null, true)).toEqual({ kind: 'ignore' });
  });

  it('ignores USER_UPDATED, PASSWORD_RECOVERY and unknown events', () => {
    for (const event of ['USER_UPDATED', 'PASSWORD_RECOVERY', 'MFA_CHALLENGE_VERIFIED', 'WHATEVER']) {
      expect(classifyAuthEvent(event, googleSession, true)).toEqual({ kind: 'ignore' });
      expect(classifyAuthEvent(event, null, false)).toEqual({ kind: 'ignore' });
    }
  });

  it('replays the reopen sequence without ever clearing', () => {
    // Frame 1: provider mounts, status restoring.
    // Frame 2: listener emits INITIAL_SESSION (null) while refresh is away.
    // Frame 3: refresh lands, boot reports ready.
    // The only acceptable action before frame 3 is `ignore`.
    const frame2 = classifyAuthEvent('INITIAL_SESSION', null, false);
    expect(frame2.kind).toBe('ignore');
    expect(frame2).not.toHaveProperty('kind', 'signout');
  });
});
