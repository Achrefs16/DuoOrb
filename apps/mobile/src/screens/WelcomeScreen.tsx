import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME, useStyles } from '../theme';
import { GoogleGLogo } from '../components/GoogleGLogo';
import type { LegalKind } from '../legal-content';
import { useTranslation } from '../i18n';

interface WelcomeScreenProps {
  onContinueAsGuest: () => void;
  onContinueWithGoogle: () => void;
  googleBusy: boolean;
  /** True while the server mints guest credentials. */
  guestBusy?: boolean;
  error?: string | null;
  /** Opens the native in-app reader (OnboardingFlow shows it modally). */
  onOpenLegal: (kind: LegalKind) => void;
  /** Opens the language selection modal. */
  onOpenLanguage?: () => void;
}

/** Google's button blue (busy spinner). */
const GOOGLE_BLUE = '#0B57D0';
/** Guest button blue (Tailwind blue-600). */
const GUEST_BLUE = '#2563eb';

/**
 * First-launch welcome. Shown once per device, never on later launches.
 *
 * Plain white page. "Continue with Google" is the white button with the
 * full-colour G; "Continue as Guest" is the solid blue button underneath.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinueAsGuest,
  onContinueWithGoogle,
  googleBusy,
  guestBusy,
  error,
  onOpenLegal,
  onOpenLanguage,
}) => {
  const styles = useStyles(createStyles);
  const { t, currentLanguage } = useTranslation();
  const busy = googleBusy || !!guestBusy;

  return (
    <View style={styles.container}>
      {/* Top bar with language selector */}
      <View style={styles.topBar}>
        {onOpenLanguage && (
          <TouchableOpacity
            style={styles.langButton}
            activeOpacity={0.75}
            onPress={onOpenLanguage}
            accessibilityLabel={t('language.rowTitle')}
            accessibilityRole="button"
          >
            <Text style={styles.langFlag}>{currentLanguage.flag}</Text>
            <Text style={styles.langText}>{currentLanguage.nativeName}</Text>
            <Feather name="chevron-down" size={14} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        <Image
          source={require('../../assets/logo-512.webp')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel={t('welcome.logoA11y')}
        />
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.tagline')}</Text>
        <Text style={styles.maker}>{t('welcome.by')}</Text>
      </View>

      <View style={styles.actions}>
        {googleBusy ? (
          <View style={[styles.googleButton, styles.buttonBusy]}>
            <ActivityIndicator size="small" color={GOOGLE_BLUE} />
            <Text style={styles.googleButtonText}>{t('welcome.signingIn')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={onContinueWithGoogle}
            disabled={busy}
            accessibilityLabel={t('welcome.google')}
          >
            <GoogleGLogo size={20} />
            <Text style={styles.googleButtonText}>{t('welcome.google')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.guestButton}
          activeOpacity={0.85}
          onPress={onContinueAsGuest}
          disabled={busy}
          accessibilityLabel={t('welcome.guest')}
        >
          {guestBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="user" size={17} color="#FFFFFF" />
          )}
          <Text style={styles.guestButtonText}>
            {guestBusy ? t('welcome.starting') : t('welcome.guest')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.noticeText}>
          {t('welcome.noticeBefore')}{' '}
          <Text style={styles.legalLink} onPress={() => onOpenLegal('terms')}>
            {t('welcome.terms')}
          </Text>{' '}
          {t('welcome.noticeMiddle')}{' '}
          <Text style={styles.legalLink} onPress={() => onOpenLegal('privacy')}>
            {t('welcome.privacy')}
          </Text>
          {t('welcome.noticeAfter')}
        </Text>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: THEME.colors.background,
      paddingHorizontal: 24,
      paddingTop: 48,
      paddingBottom: 40,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      minHeight: 36,
    },
    langButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: THEME.radius.full,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: THEME.colors.surfaceHairline,
    },
    langFlag: {
      fontSize: 16,
    },
    langText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      color: THEME.colors.textPrimary,
    },
    body: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 120,
      height: 120,
    },
    title: {
      marginTop: 16,
      fontFamily: THEME.fonts.bold,
      fontSize: 24,
      letterSpacing: -0.3,
      color: THEME.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 8,
      fontFamily: THEME.fonts.medium,
      fontSize: 14,
      letterSpacing: 0.2,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
    },
    maker: {
      marginTop: 4,
      fontFamily: THEME.fonts.medium,
      fontSize: 12,
      color: THEME.colors.textMuted,
      textAlign: 'center',
    },
    actions: {
      gap: 10,
    },
    googleButton: {
      height: 50,
      borderRadius: THEME.radius.md,
      backgroundColor: THEME.colors.backgroundElevated,
      borderWidth: 1,
      borderColor: THEME.colors.outlineVariant,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    buttonBusy: {
      opacity: 0.75,
    },
    googleButtonText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 15,
      color: THEME.colors.textPrimary,
    },
    guestButton: {
      height: 50,
      borderRadius: THEME.radius.md,
      backgroundColor: GUEST_BLUE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    guestButtonText: {
      fontFamily: THEME.fonts.semiBold,
      fontSize: 15,
      color: '#FFFFFF',
    },
    noticeText: {
      marginTop: 6,
      paddingHorizontal: 8,
      fontFamily: THEME.fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      fontFamily: THEME.fonts.medium,
      fontSize: 12,
      color: THEME.colors.danger,
      textAlign: 'center',
      marginTop: 4,
    },
    legalLink: {
      fontFamily: THEME.fonts.semiBold,
      color: THEME.colors.primary,
      textDecorationLine: 'underline',
    },
  });
