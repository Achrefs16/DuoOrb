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
import { THEME } from '../theme';
import { GoogleGLogo } from '../components/GoogleGLogo';
import type { LegalKind } from '../legal-content';

interface WelcomeScreenProps {
  onContinueAsGuest: () => void;
  onContinueWithGoogle: () => void;
  googleBusy: boolean;
  /** True while the server mints guest credentials. */
  guestBusy?: boolean;
  error?: string | null;
  /** Opens the native in-app reader (OnboardingFlow shows it modally). */
  onOpenLegal: (kind: LegalKind) => void;
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
 *
 * No checkbox: tapping either button IS the acceptance. The notice below
 * states that continuing agrees to the Terms + Privacy Policy, and both
 * open in the in-app reader before any account exists.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinueAsGuest,
  onContinueWithGoogle,
  googleBusy,
  guestBusy,
  error,
  onOpenLegal,
}) => {
  const busy = googleBusy || !!guestBusy;

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Image
          source={require('../../assets/Glossy Orbital Duo Logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="DuoOrb logo"
        />
        <Text style={styles.title}>Welcome to DuoOrb</Text>
        <Text style={styles.subtitle}>Play. Compete. Improve.</Text>
        <Text style={styles.maker}>by AS Digital</Text>
      </View>

      <View style={styles.actions}>
        {googleBusy ? (
          <View style={[styles.googleButton, styles.buttonBusy]}>
            <ActivityIndicator size="small" color={GOOGLE_BLUE} />
            <Text style={styles.googleButtonText}>Signing in…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={onContinueWithGoogle}
            disabled={busy}
            accessibilityLabel="Continue with Google"
          >
            <GoogleGLogo size={20} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.guestButton}
          activeOpacity={0.85}
          onPress={onContinueAsGuest}
          disabled={busy}
          accessibilityLabel="Continue as guest"
        >
          {guestBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Feather name="user" size={17} color="#FFFFFF" />
          )}
          <Text style={styles.guestButtonText}>
            {guestBusy ? 'Starting…' : 'Continue as Guest'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.noticeText}>
          By continuing as a guest or signing in, you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => onOpenLegal('terms')}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text style={styles.legalLink} onPress={() => onOpenLegal('privacy')}>
            Privacy Policy
          </Text>
          .
        </Text>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
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
  // Google's own light-button treatment: white, hairline border, dark label,
// full-colour G. Radius matches the rest of DuoOrb.
  googleButton: {
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: '#FFFFFF',
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
  // Solid blue primary action for guests.
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
  // The acceptance notice: continuing IS agreeing, so no checkbox. Both
  // documents open in the in-app reader.
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
