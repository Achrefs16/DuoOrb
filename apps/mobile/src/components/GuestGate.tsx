import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { THEME } from '../theme';
import { GoogleGLogo } from './GoogleGLogo';
import { useSession } from '../network/session';

interface GuestGateProps {
  /** Lock headline, e.g. "Friends need saving". */
  title: string;
  /** Why linking matters, e.g. the lock copy. */
  message: string;
  /** Optional second action, e.g. "Later" to dismiss a nudge. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Compact paddings when embedded inside cards or modals. */
  mini?: boolean;
}

/**
 * The single soft-gate for guests: every locked social surface renders this
 * instead of duplicating lock UI. Guests keep full gameplay; this only owns
 * the social upsell and the one-tap Google link.
 *
 * Renders nothing once the account is linked, so every lock disappears by
 * itself the moment `linkGuestProgress` flips the session.
 */
export const GuestGate: React.FC<GuestGateProps> = memo(function GuestGate({
  title,
  message,
  secondaryLabel,
  onSecondary,
  mini = false,
}) {
  const { identity, signInWithGoogle, signingIn, error } = useSession();
  if (!identity?.isGuest) return null;

  return (
    <View style={[styles.card, mini && styles.cardMini]}>
      <Text style={[styles.title, mini && styles.titleMini]}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        style={[styles.linkButton, signingIn && styles.disabled]}
        activeOpacity={0.85}
        onPress={() => void signInWithGoogle()}
        disabled={signingIn}
        accessibilityLabel="Save with Google"
        accessibilityRole="button"
      >
        <View style={styles.logoBox}>
          {signingIn ? (
            <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
          ) : (
            <GoogleGLogo size={18} />
          )}
        </View>
        <Text style={styles.linkButtonText}>
          {signingIn ? 'Saving…' : 'Save with Google'}
        </Text>
      </TouchableOpacity>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!!secondaryLabel && !!onSecondary && (
        <TouchableOpacity
          style={styles.secondary}
          activeOpacity={0.7}
          onPress={onSecondary}
          disabled={signingIn}
          accessibilityLabel={secondaryLabel}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: THEME.radius.lg,
    padding: 20,
    alignItems: 'center',
    ...THEME.shadows.card,
  },
  cardMini: {
    padding: 16,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  titleMini: {
    fontSize: 15,
  },
  message: {
    marginTop: 8,
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 14,
    height: 50,
    width: '100%',
    borderRadius: THEME.radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pinned left, outside layout: the label stays optically centered no
  // matter the icon's metrics, and no gap quirk can shift the row.
  logoBox: {
    position: 'absolute',
    left: 16,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  linkButtonText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.danger,
    textAlign: 'center',
  },
  secondary: {
    marginTop: 6,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
});
