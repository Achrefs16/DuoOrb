import React, { useCallback, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useSession } from '../network/session';
import type { LegalKind } from '../legal-content';
import { WelcomeScreen } from './WelcomeScreen';
import { LegalScreen } from './LegalScreen';

/**
 * First-run flow: Welcome only (account creation).
 *
 * Rendered only while the session is anonymous. Both entry points (guest and
 * Google) flip the session to ready, at which point the App-level gate takes
 * over and shows the username step — so this flow never needs to know about
 * it. Nobody lands on Home still carrying an auto-generated handle.
 *
 * This is also the ONLY place a guest account is ever created: pressing
 * Continue as Guest is the single call to the guest endpoint. Startup never
 * reaches this screen with credentials already minted.
 *
 * No acceptance checkbox: the Welcome notice states that continuing (guest
 * or Google) agrees to the Terms + Privacy Policy. The legal reader opens
 * modally here so policies are readable INSIDE the app (the same text is
 * also hosted at /legal/* for the Play Console URLs).
 */
export const OnboardingFlow: React.FC = () => {
  const { signingIn, error, signInWithGoogle, continueAsGuest } = useSession();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);

  const startAsGuest = useCallback(async () => {
    setStartingGuest(true);
    setGuestError(null);
    try {
      // The one and only account-creation call in the app. On success the
      // session flips to ready and the App gate shows the username step.
      const ok = await continueAsGuest();
      if (!ok) {
        setGuestError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setStartingGuest(false);
    }
  }, [continueAsGuest]);

  const startWithGoogle = useCallback(() => {
    void signInWithGoogle();
  }, [signInWithGoogle]);

  return (
    <View style={styles.fill}>
      <WelcomeScreen
        onContinueAsGuest={() => void startAsGuest()}
        onContinueWithGoogle={startWithGoogle}
        googleBusy={signingIn}
        guestBusy={startingGuest}
        error={guestError ?? error}
        onOpenLegal={(kind) => setLegalKind(kind)}
      />
      <Modal visible={legalKind !== null} animationType="slide" onRequestClose={() => setLegalKind(null)}>
        {legalKind && <LegalScreen kind={legalKind} onBack={() => setLegalKind(null)} />}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
