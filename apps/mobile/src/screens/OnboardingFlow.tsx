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
 * First-launch flow: Welcome -> Choose Username.
 *
 * Both entry points (guest and Google) continue to the username step, so
 * nobody lands on Home while still carrying an auto-generated handle.
 */
export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onFinish }) => {
  const { identity, profile, profileLoading, signingIn, error, signInWithGoogle } =
    useSession();
  // `null` means "not chosen yet": Google sign-in resolves out of band (system
  // browser), so a successful sign-in derives the username step by itself.
  // Only the guest button needs to force it.
  const [guestChoseToContinue, setGuestChoseToContinue] = useState(false);
  const signedIn = !identity.isGuest;
  const step: 'welcome' | 'username' =
    signedIn || guestChoseToContinue ? 'username' : 'welcome';

  const finish = useCallback(() => {
    void markOnboardingComplete();
    onFinish();
  }, [onFinish]);

  /**
   * If a real username is already on the account there is nothing to choose,
   * so finish instead of showing a step that would be a no-op. This must go
   * through `finish` — skipping straight to onFinish would leave the device
   * un-onboarded and the welcome screen would return on every launch.
   */
  const needsUsername = isGeneratedUsername(
    profile?.username ?? identity.username,
    identity.userId
  );
  useEffect(() => {
    if (profileLoading || !profile) return;
    if (!needsUsername) finish();
  }, [profileLoading, profile, needsUsername, finish]);

  if (step === 'welcome') {
    return (
      <WelcomeScreen
        // The guest identity already exists (hydrateIdentity ran at boot), so
        // continuing as a guest only means moving on to the username step.
        onContinueAsGuest={() => setGuestChoseToContinue(true)}
        onContinueWithGoogle={() => void signInWithGoogle()}
        googleBusy={signingIn}
        error={error}
      />
    );
  }

  return <ChooseUsernameScreen onDone={finish} />;
};
