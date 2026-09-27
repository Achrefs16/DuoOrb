import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from '../network/session';
import { isGeneratedUsername } from '../usernamePolicy';
import { markOnboardingComplete } from '../storage/onboarding';
import { WelcomeScreen } from './WelcomeScreen';
import { ChooseUsernameScreen } from './ChooseUsernameScreen';

interface OnboardingFlowProps {
  /** Called once the player is through the flow. */
  onFinish: () => void;
}

/**
 * First-run flow: Welcome -> Choose Username.
 *
 * Rendered only while the session is NOT ready. Both entry points (guest and
 * Google) continue to the username step, so nobody lands on Home still
 * carrying an auto-generated handle.
 *
 * This is also the ONLY place a guest account is ever created: pressing
 * Continue as Guest is the single call to the guest endpoint. Startup never
 * reaches this screen with credentials already minted.
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onFinish }) => {
  const { identity, status, signingIn, error, signInWithGoogle, continueAsGuest } = useSession();
  // `null` means "not chosen yet": Google sign-in resolves out of band (system
  // browser), so a successful sign-in derives the username step by itself.
  // Only the guest button needs to force it.
  const [guestChoseToContinue, setGuestChoseToContinue] = useState(false);
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const signedIn = identity ? !identity.isGuest : false;
  const step: 'welcome' | 'username' = signedIn || guestChoseToContinue ? 'username' : 'welcome';

  const startAsGuest = useCallback(async () => {
    setStartingGuest(true);
    setGuestError(null);
    try {
      // The one and only account-creation call in the app.
      const ok = await continueAsGuest();
      if (!ok) {
        setGuestError('Could not reach the server. Check your connection and try again.');
        return;
      }
      setGuestChoseToContinue(true);
    } finally {
      setStartingGuest(false);
    }
  }, [continueAsGuest]);

  const finish = useCallback(() => {
    void markOnboardingComplete();
    onFinish();
  }, [onFinish]);

  const needsUsername = isGeneratedUsername(
    identity?.username ?? null,
    identity?.userId ?? ''
  );
  useEffect(() => {
    // A session that became ready without passing through the buttons (a
    // restored guest whose handle is already chosen) has nothing to ask.
    if (status !== 'ready') return;
    if (!needsUsername) finish();
  }, [status, needsUsername, finish]);

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        onContinueAsGuest={() => void startAsGuest()}
        onContinueWithGoogle={() => void signInWithGoogle()}
        googleBusy={signingIn}
        guestBusy={startingGuest}
        error={guestError ?? error}
      />
    );
  }

  return <ChooseUsernameScreen onDone={finish} />;
};
