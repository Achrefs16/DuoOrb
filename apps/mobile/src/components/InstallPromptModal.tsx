import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrbIcon } from './OrbIcon';
import { THEME, useStyles } from '../theme';

import {
  COOLDOWN_MS,
  GOOGLE_PLAY_URL,
  STORAGE_KEY_DISMISSED,
  WebInstallPlatform,
  detectWebInstallPlatform,
  isInstallPromptCooledDown,
} from '../lib/installPrompt';

export {
  COOLDOWN_MS,
  GOOGLE_PLAY_URL,
  STORAGE_KEY_DISMISSED,
  WebInstallPlatform,
  detectWebInstallPlatform,
  isInstallPromptCooledDown,
};

interface InstallPromptModalProps {
  visible: boolean;
  onClose: () => void;
  /** If true, opens regardless of 7-day cooldown (e.g. from user manual tap). */
  forceShow?: boolean;
}

export const InstallPromptModal: React.FC<InstallPromptModalProps> = ({
  visible,
  onClose,
  forceShow = false,
}) => {
  const styles = useStyles(createStyles);
  const [canShow, setCanShow] = useState(false);
  const [hasDeferredPrompt, setHasDeferredPrompt] = useState(false);

  const { platform, isStandalone } = detectWebInstallPlatform();

  useEffect(() => {
    if (!visible || isStandalone || platform === 'none') {
      setCanShow(false);
      return;
    }

    if (forceShow) {
      setCanShow(true);
      return;
    }

    // Check cooldown
    AsyncStorage.getItem(STORAGE_KEY_DISMISSED).then((val) => {
      if (!val) {
        setCanShow(true);
        return;
      }
      const lastDismissed = parseInt(val, 10);
      if (isNaN(lastDismissed) || Date.now() - lastDismissed > COOLDOWN_MS) {
        setCanShow(true);
      } else {
        setCanShow(false);
      }
    });
  }, [visible, forceShow, isStandalone, platform]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const checkPrompt = () => {
      const p = (window as unknown as { __duoorbDeferredPrompt?: unknown }).__duoorbDeferredPrompt;
      setHasDeferredPrompt(Boolean(p));
    };

    checkPrompt();
    window.addEventListener('duoorb:install-ready', checkPrompt);
    return () => window.removeEventListener('duoorb:install-ready', checkPrompt);
  }, []);

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
    } catch {
      // Storage unavailable, ignore
    }
    setCanShow(false);
    onClose();
  };

  const handleGooglePlay = () => {
    Linking.openURL(GOOGLE_PLAY_URL).catch(() => {});
    handleDismiss();
  };

  const handleInstallPwa = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const promptEvent = (
      window as unknown as {
        __duoorbDeferredPrompt?: {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
        };
      }
    ).__duoorbDeferredPrompt;

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === 'accepted') {
          handleDismiss();
        }
      } catch {
        handleDismiss();
      }
    }
  };

  if (!visible || !canShow || isStandalone || platform === 'none') {
    return null;
  }

  return (
    <Modal
      visible={canShow}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header Icon + Title */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <OrbIcon
                name="cellphone-arrow-down"
                size={28}
                color={THEME.colors.primary}
              />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>
                {platform === 'ios'
                  ? 'Install DuoOrb on iPhone'
                  : platform === 'android'
                  ? 'Get the DuoOrb App'
                  : 'Install DuoOrb'}
              </Text>
              <Text style={styles.badgeText}>
                {platform === 'ios'
                  ? 'Full-Screen • Offline Bots • Instant Launch'
                  : 'Smoother 60fps • Offline Bots • Pure Strategy'}
              </Text>
            </View>
          </View>

          {/* Content Body Based on Platform */}
          {platform === 'ios' ? (
            <View style={styles.bodyWrap}>
              <Text style={styles.instructionIntro}>
                Install as a full-screen app in two simple steps:
              </Text>

              <View style={styles.stepCard}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNum}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>
                    Tap the <Text style={styles.stepBold}>Share</Text> button in
                    your Safari toolbar:
                  </Text>
                  <View style={styles.iconRow}>
                    <OrbIcon name="share" size={16} color={THEME.colors.primary} />
                    <Text style={styles.iconDesc}>Square with arrow pointing up</Text>
                  </View>
                </View>
              </View>

              <View style={styles.stepCard}>
                <View style={styles.stepNumCircle}>
                  <Text style={styles.stepNum}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepText}>
                    Scroll down and tap{' '}
                    <Text style={styles.stepBold}>"Add to Home Screen"</Text>:
                  </Text>
                  <View style={styles.iconRow}>
                    <OrbIcon name="plus-square" size={16} color={THEME.colors.primary} />
                    <Text style={styles.iconDesc}>Plus icon in actions list</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : platform === 'android' ? (
            <View style={styles.bodyWrap}>
              <Text style={styles.instructionIntro}>
                Experience the game at its best with zero browser URL bar distractions and instant offline play:
              </Text>

              {/* Primary Google Play CTA */}
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.85}
                onPress={handleGooglePlay}
              >
                <OrbIcon name="google-play" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Install from Google Play</Text>
              </TouchableOpacity>

              {/* Secondary PWA CTA (if supported by browser) */}
              {hasDeferredPrompt && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  activeOpacity={0.8}
                  onPress={handleInstallPwa}
                >
                  <OrbIcon name="download" size={16} color={THEME.colors.textPrimary} />
                  <Text style={styles.secondaryButtonText}>
                    Or Install Instant Web App (2 MB)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.bodyWrap}>
              <Text style={styles.instructionIntro}>
                Install DuoOrb on your desktop for quick launch and offline board game sparring:
              </Text>
              {hasDeferredPrompt ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={handleInstallPwa}
                >
                  <OrbIcon name="download" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Install Desktop App</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  activeOpacity={0.85}
                  onPress={handleGooglePlay}
                >
                  <OrbIcon name="google-play" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>View on Google Play</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.dismissButton}
              activeOpacity={0.7}
              onPress={handleDismiss}
            >
              <Text style={styles.dismissButtonText}>
                {platform === 'ios' ? 'Got It' : 'Maybe Later'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = () =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 18,
      zIndex: 99999,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: 'rgba(15, 23, 42, 0.96)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderRadius: 20,
      padding: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 16,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(99, 102, 241, 0.14)',
      borderColor: 'rgba(99, 102, 241, 0.35)',
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTextWrap: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    badgeText: {
      fontSize: 11.5,
      color: THEME.colors.textMuted,
      fontWeight: '500',
    },
    bodyWrap: {
      gap: 12,
      marginBottom: 18,
    },
    instructionIntro: {
      fontSize: 13,
      color: THEME.colors.textSecondary,
      lineHeight: 18,
      marginBottom: 4,
    },
    stepCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: 'rgba(30, 41, 59, 0.7)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
    },
    stepNumCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: THEME.colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    stepNum: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    stepContent: {
      flex: 1,
      gap: 4,
    },
    stepText: {
      fontSize: 13,
      color: '#FFFFFF',
      lineHeight: 17,
    },
    stepBold: {
      fontWeight: '700',
      color: '#A5B4FC',
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    iconDesc: {
      fontSize: 11.5,
      color: THEME.colors.textMuted,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: THEME.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      shadowColor: THEME.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: 'rgba(30, 41, 59, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
      marginTop: 4,
    },
    secondaryButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: THEME.colors.textPrimary,
    },
    footer: {
      alignItems: 'center',
    },
    dismissButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    dismissButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: THEME.colors.textMuted,
    },
  });
