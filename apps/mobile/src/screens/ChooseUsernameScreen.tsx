import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME, useStyles } from '../theme';
import { KeyboardShift } from '../components/KeyboardShift';
import { api, ApiError } from '../network/apiClient';
import { useSession } from '../network/session';
import {
  sanitizeUsernameInput,
  validateUsername,
  USERNAME_MAX,
} from '../usernamePolicy';
import { useTranslation } from '../i18n';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

/** Guest primary-button blue, matching the Welcome page. */
const GUEST_BLUE = '#2563eb';

// Web only: kill the black focus outline on text inputs (not in RN types).
const NO_OUTLINE: any = Platform.OS === 'web' ? { outlineStyle: 'none' } : {};

interface ChooseUsernameScreenProps {
  onDone: () => void;
}

/**
 * Username step. Rendered full-screen by the App-level gate while the handle
 * is still server-generated and onboarding never completed — no tabs behind
 * it. Every new identity passes through here and leaves with a real handle:
 * there is no skip, so nobody reaches the app with an auto-generated name.
 */
export const ChooseUsernameScreen: React.FC<ChooseUsernameScreenProps> = ({ onDone }) => {
  const styles = useStyles(createStyles);
  const { identity, refreshProfile } = useSession();
  const { t } = useTranslation();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [saving, setSaving] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const prefilled = useRef(false);
  const verifySeq = useRef(0);
  // Tracked only so the style visibly never depends on it: focus must not
  // change the border on any platform.
  const focusedRef = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // The canonical identity is the only source: the profile state mirrors it
  // after `/me`, so both always agree.
  const currentUsername = identity?.username ?? null;

  const verifyCandidates = useCallback(async (candidates: string[]) => {
    verifySeq.current += 1;
    const seq = verifySeq.current;
    for (const candidate of candidates) {
      try {
        const res = await api.checkUsernameAvailability(candidate);
        if (!mounted.current || seq !== verifySeq.current) return;
        if (res.available) {
          setDraft(candidate);
          setAvailability('available');
          return;
        }
      } catch {
        // Try the next candidate; a dead network leaves the field empty.
      }
    }
    if (mounted.current && seq === verifySeq.current) setAvailability('idle');
  }, []);

  // Pre-fill with the handle the backend just created: tapping Continue
  // untouched keeps exactly this name (save short-circuits below), editing
  // replaces it. Waits for a non-empty handle — Google profiles load a beat
  // after the gate opens this screen. Never clobbers typing in progress.
  useEffect(() => {
    if (prefilled.current || !currentUsername || draft !== '') return;
    prefilled.current = true;
    setDraft(currentUsername);
    setAvailability('idle');
    setError(null);
  }, [currentUsername, draft]);

  // Debounced availability probe. Only fires for a well-formed handle that is
  // not the one already saved.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const check = validateUsername(draft);
    if (!check.ok || check.value === currentUsername) return;

    timer.current = setTimeout(async () => {
      setAvailability('checking');
      try {
        const res = await api.checkUsernameAvailability(check.value);
        if (!mounted.current) return;
        setAvailability(res.available ? 'available' : 'taken');
      } catch {
        if (!mounted.current) return;
        setAvailability('error');
      }
    }, 350);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, currentUsername]);

  const shuffle = useCallback(() => {
    setError(null);
    setAvailability('checking');
    void verifyCandidates(buildCandidates(identity?.displayName ?? null, draft));
  }, [identity, draft, verifyCandidates]);

  const save = useCallback(async () => {
    const check = validateUsername(draft);
    if (!check.ok) {
      setError(check.error ?? t('username.invalid'));
      return;
    }
    // Unchanged from the backend handle: nothing to write, just continue.
    if (check.value === currentUsername) {
      if (mounted.current) onDone();
      return;
    }
    if (availability === 'taken') {
      setError(t('username.takenError'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.updateUsername(check.value);
      await refreshProfile();
      if (mounted.current) onDone();
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 409) {
        setError(t('username.takenError'));
        setAvailability('taken');
      } else {
        setError(e instanceof Error ? e.message : t('username.saveFailed'));
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [draft, availability, currentUsername, refreshProfile, onDone, t]);

  const checked = validateUsername(draft);
  const hint = (() => {
    // The backend handle itself: no probe, no stale taken/available label.
    if (currentUsername && checked.value === currentUsername) return null;
    if (draft && !checked.ok) return checked.error ?? null;
    if (availability === 'checking') return t('username.checking');
    if (availability === 'available') {
      return t('username.available', { name: validateUsername(draft).value });
    }
    if (availability === 'taken') return t('username.taken');
    if (availability === 'error') return t('username.checkFailed');
    return null;
  })();

  return (
    <KeyboardShift>
    <View style={styles.container}>
      <View style={styles.body}>
        <Image
          source={require('../../assets/logo-512.webp')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel={t('welcome.logoA11y')}
        />
        <Text style={styles.title}>{t('username.title')}</Text>
        <Text style={styles.subtitle}>
          {t('username.subtitle')}
        </Text>

        <View style={styles.fieldRow}>
          <View style={styles.inputRow}>
            <Text style={styles.prefix}>@</Text>
            <TextInput
              style={[styles.input, NO_OUTLINE]}
              placeholder="yourname"
              placeholderTextColor={THEME.colors.textMuted}
              value={draft}
              onChangeText={(t) => {
                setDraft(sanitizeUsernameInput(t));
                setError(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              maxLength={USERNAME_MAX}
              returnKeyType="go"
              onSubmitEditing={() => void save()}
              underlineColorAndroid="transparent"
              selectionColor={THEME.colors.primary}
              onFocus={() => {
                focusedRef.current = true;
              }}
              onBlur={() => {
                focusedRef.current = false;
              }}
            />
          </View>
          <TouchableOpacity
            style={styles.shuffleBtn}
            activeOpacity={0.7}
            onPress={shuffle}
            disabled={saving}
            accessibilityLabel={t('username.shuffleA11y')}
            accessibilityRole="button"
          >
            <Feather name="shuffle" size={18} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.help}>
          {t('username.help', { max: USERNAME_MAX })}
        </Text>

        {!!hint && (
          <Text
            style={[
              styles.status,
              availability === 'available' && styles.statusOk,
              availability === 'taken' && styles.statusBad,
            ]}
          >
            {hint}
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primary, (!checked.ok || saving) && styles.disabled]}
          disabled={saving || !checked.ok}
          activeOpacity={0.85}
          onPress={() => void save()}
        >
          {saving ? (
            <View style={styles.primaryRow}>
              <ActivityIndicator size="small" color={THEME.colors.onPrimary} />
              <Text style={styles.primaryText}>{t('common.saving')}</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>
              {checked.ok ? t('username.continueAs', { name: checked.value }) : t('common.continue')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardShift>
  );
};

/**
 * Ordered handle suggestions: the player's own name first (Google display
 * name, guest handle), then a numbered variant of it, then `player` + random
 * digits. Anything failing local policy is dropped before any network call.
 */
function buildCandidates(displayName: string | null, exclude: string): string[] {
  const out: string[] = [];
  const push = (value: string) => {
    if (value && value !== exclude && !out.includes(value) && validateUsername(value).ok) {
      out.push(value);
    }
  };
  const base = sanitizeUsernameInput(displayName ?? '');
  push(base);
  if (base) {
    push(`${base}${Math.floor(10 + Math.random() * 90)}`.slice(0, USERNAME_MAX));
  }
  for (let i = 0; i < 10 && out.length < 3; i++) {
    push(`player${Math.floor(1000 + Math.random() * 9000)}`);
  }
  return out;
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
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
    width: 96,
    height: 96,
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
    marginBottom: 22,
    fontFamily: THEME.fonts.medium,
    fontSize: 14,
    letterSpacing: 0.2,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
  },
  inputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    paddingHorizontal: 14,
  },
  prefix: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    color: THEME.colors.textMuted,
  },
  input: {
    flex: 1,
    fontFamily: THEME.fonts.semiBold,
    paddingVertical: 13,
    paddingHorizontal: 6,
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  shuffleBtn: {
    width: 50,
    height: 50,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: THEME.colors.backgroundCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  help: {
    marginTop: 10,
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
  },
  status: {
    marginTop: 8,
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  statusOk: {
    color: THEME.colors.success,
  },
  statusBad: {
    color: THEME.colors.danger,
  },
  error: {
    marginTop: 8,
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: THEME.colors.danger,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  primary: {
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: GUEST_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondary: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  disabled: {
    opacity: 0.45,
  },
});
