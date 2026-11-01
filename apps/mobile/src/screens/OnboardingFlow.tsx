import React, { useCallback, useState } from 'react';
import { Modal, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../network/session';
import type { LegalKind } from '../legal-content';
import { WelcomeScreen } from './WelcomeScreen';
import { LegalScreen } from './LegalScreen';
import { ReviewerLoginScreen } from './ReviewerLoginScreen';
import { LanguageSelectModal } from '../components/LanguageSelectModal';
import { useTranslation } from '../i18n';
import { THEME } from '../theme';

/**
 * First-run flow: Welcome (account creation). The language picker opens
 * ONLY from the header language button — never automatically — and from
 * Settings at any time. Reviewer login opens via the discreet link below actions.
 */
export const OnboardingFlow: React.FC = () => {
  const { t } = useTranslation();
  const { signingIn, error, signInWithGoogle, continueAsGuest } = useSession();
  const [startingGuest, setStartingGuest] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [reviewerLoginVisible, setReviewerLoginVisible] = useState(false);

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
        onOpenReviewerLogin={() => {
          setReviewerLoginVisible(true);
        }}
      />
      <Modal visible={legalKind !== null} animationType="slide" onRequestClose={() => setLegalKind(null)}>
        {/* Modals are their own native window: the app root's top inset does
            not reach them. LegalScreen already owns the bottom inset. */}
        <SafeAreaView style={styles.fill} edges={['top']}>
          {legalKind && <LegalScreen kind={legalKind} onBack={() => setLegalKind(null)} />}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={reviewerLoginVisible}
        animationType="slide"
        onRequestClose={() => setReviewerLoginVisible(false)}
      >
        <SafeAreaView style={styles.fill} edges={['top']}>
          <ReviewerLoginScreen
            onBack={() => setReviewerLoginVisible(false)}
            onSuccess={() => setReviewerLoginVisible(false)}
          />
        </SafeAreaView>
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
  fill: { flex: 1, backgroundColor: THEME.colors.background },
});
