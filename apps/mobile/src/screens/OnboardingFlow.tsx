import React, { useCallback, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { useSession } from '../network/session';
import type { LegalKind } from '../legal-content';
import { WelcomeScreen } from './WelcomeScreen';
import { LegalScreen } from './LegalScreen';
import { LanguageSelectModal } from '../components/LanguageSelectModal';
import { useTranslation } from '../i18n';

/**
 * First-run flow: Welcome (account creation). The language picker opens
 * ONLY from the header language button — never automatically — and from
 * Settings at any time.
 */
export const OnboardingFlow: React.FC = () => {
  const { t } = useTranslation();
  const { signingIn, error, signInWithGoogle, continueAsGuest } = useSession();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const startAsGuest = useCallback(async () => {
    setStartingGuest(true);
    setGuestError(null);
    try {
      const ok = await continueAsGuest();
      if (!ok) {
        setGuestError(t('welcome.guestError'));
      }
    } finally {
      setStartingGuest(false);
    }
  }, [continueAsGuest, t]);

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
        onOpenLanguage={() => {
          setLanguageModalVisible(true);
        }}
      />
      <Modal visible={legalKind !== null} animationType="slide" onRequestClose={() => setLegalKind(null)}>
        {legalKind && <LegalScreen kind={legalKind} onBack={() => setLegalKind(null)} />}
      </Modal>

      <LanguageSelectModal
        visible={languageModalVisible}
        onClose={() => {
          setLanguageModalVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
