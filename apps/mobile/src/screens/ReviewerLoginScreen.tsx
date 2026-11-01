import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OrbIcon } from '../components/OrbIcon';
import { KeyboardShift } from '../components/KeyboardShift';
import { THEME, useStyles } from '../theme';
import { useSession } from '../network/session';
import { useTranslation } from '../i18n';

const NO_OUTLINE: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};

interface ReviewerLoginScreenProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export const ReviewerLoginScreen: React.FC<ReviewerLoginScreenProps> = ({
  onBack,
  onSuccess,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signInWithReviewer, signingIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  const busy = signingIn || localBusy;

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError(t('reviewer.fillAll'));
      return;
    }

    setLocalBusy(true);
    try {
      const result = await signInWithReviewer(cleanEmail, password);
      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.error || t('reviewer.error'));
      }
    } catch (e: any) {
      setError(e?.message || t('reviewer.error'));
    } finally {
      setLocalBusy(false);
    }
  }, [email, password, busy, signInWithReviewer, onSuccess, t]);

  return (
    <KeyboardShift>
      <View style={[styles.container, { paddingTop: Math.max(16, insets.top), paddingBottom: Math.max(24, insets.bottom) }]}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('common.back') || 'Back'}
          >
            <OrbIcon name="arrow-left" size={22} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('reviewer.title')}</Text>
          <View style={styles.backPlaceholder} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/logo-512.webp')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>{t('reviewer.title')}</Text>
          <Text style={styles.subtitle}>{t('reviewer.subtitle')}</Text>

          {/* Form */}
          <View style={styles.form}>
            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('reviewer.email')}</Text>
              <View style={styles.inputWrap}>
                <OrbIcon name="mail" size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, NO_OUTLINE]}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (error) setError(null);
                  }}
                  placeholder={t('reviewer.emailPlaceholder')}
                  placeholderTextColor={THEME.colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!busy}
                />
              </View>
            </View>

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>{t('reviewer.password')}</Text>
              <View style={styles.inputWrap}>
                <OrbIcon name="lock" size={18} color={THEME.colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput, NO_OUTLINE]}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    if (error) setError(null);
                  }}
                  placeholder={t('reviewer.passwordPlaceholder')}
                  placeholderTextColor={THEME.colors.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  onSubmitEditing={() => void handleSubmit()}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((p) => !p)}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle password visibility"
                >
                  <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error Message */}
            {!!error && (
              <View style={styles.errorBox}>
                <OrbIcon name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Sign in button */}
            <TouchableOpacity
              style={[styles.submitButton, busy && styles.buttonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('reviewer.signIn')}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{t('reviewer.signIn')}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimerText}>{t('reviewer.disclaimer')}</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardShift>
  );
};

const createStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: THEME.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      height: 48,
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 20,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: THEME.colors.textPrimary,
    },
    backPlaceholder: {
      width: 40,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 32,
    },
    iconContainer: {
      alignItems: 'center',
      marginVertical: 16,
    },
    logo: {
      width: 72,
      height: 72,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 14,
      color: THEME.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 28,
      paddingHorizontal: 12,
    },
    form: {
      gap: 18,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: THEME.colors.textPrimary,
      marginLeft: 2,
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: THEME.colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.colors.outline,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: THEME.colors.textPrimary,
      height: '100%',
    },
    passwordInput: {
      paddingRight: 8,
    },
    eyeButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    eyeText: {
      fontSize: 12,
      fontWeight: '600',
      color: THEME.colors.textSecondary,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF2F2',
      borderWidth: 1,
      borderColor: '#FCA5A5',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: '#B91C1C',
      lineHeight: 18,
    },
    submitButton: {
      backgroundColor: THEME.colors.primary,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    disclaimerText: {
      fontSize: 12,
      color: THEME.colors.textMuted,
      textAlign: 'center',
      lineHeight: 17,
      marginTop: 8,
      paddingHorizontal: 16,
    },
  });
