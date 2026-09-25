import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../theme';
import { DuoOrbLogo } from '../components/DuoOrbLogo';

interface WelcomeScreenProps {
  onContinueAsGuest: () => void;
  onContinueWithGoogle: () => void;
  googleBusy: boolean;
  error?: string | null;
}

/**
 * First-launch welcome. Shown once per device, never on later launches.
 *
 * Exactly two choices, no other sign-in methods, no fields, no legal text.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onContinueAsGuest,
  onContinueWithGoogle,
  googleBusy,
  error,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <DuoOrbLogo size={88} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Welcome to DuoOrb</Text>
        <Text style={styles.subtitle}>Play. Compete. Improve.</Text>
      </View>

      <View style={styles.actions}>
        {googleBusy ? (
          <View style={[styles.googleButton, styles.googleButtonBusy]}>
            <ActivityIndicator size="small" color={THEME.colors.textPrimary} />
            <Text style={styles.googleButtonText}>Signing in…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={onContinueWithGoogle}
            accessibilityLabel="Continue with Google"
          >
            <MaterialCommunityIcons name="google" size={19} color="#4285F4" />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.guestButton}
          activeOpacity={0.85}
          onPress={onContinueAsGuest}
          disabled={googleBusy}
          accessibilityLabel="Continue as guest"
        >
          <Feather name="user" size={17} color={THEME.colors.textSecondary} />
          <Text style={styles.guestButtonText}>Continue as Guest</Text>
        </TouchableOpacity>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
  },
  top: {
    alignItems: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
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
  actions: {
    gap: 10,
  },
  // White with a hairline border: the official Google treatment, kept inside
  // DuoOrb's radius, spacing and type scale.
  googleButton: {
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonBusy: {
    opacity: 0.7,
  },
  googleButtonText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  guestButton: {
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guestButtonText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 15,
    color: THEME.colors.textSecondary,
  },
  errorText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.danger,
    textAlign: 'center',
    marginTop: 4,
  },
});
