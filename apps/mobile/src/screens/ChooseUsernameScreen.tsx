import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { DuoOrbLogo } from '../components/DuoOrbLogo';
import { KeyboardShift } from '../components/KeyboardShift';
import { api, ApiError } from '../network/apiClient';
import { useSession } from '../network/session';
import {
  sanitizeUsernameInput,
  validateUsername,
  USERNAME_MAX,
} from '../usernamePolicy';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

interface ChooseUsernameScreenProps {
  onDone: () => void;
}

/**
 * Username step. Every new identity — guest or signed in — passes through
 * here, so nobody reaches the app with an auto-generated handle unless they
 * explicitly skip.
 */
export const ChooseUsernameScreen: React.FC<ChooseUsernameScreenProps> = ({ onDone }) => {
  const { identity, profile, refreshProfile } = useSession();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>('idle');
  const [saving, setSaving] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const currentUsername = profile?.username ?? identity.username ?? null;

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

  const save = useCallback(async () => {
    const check = validateUsername(draft);
    if (!check.ok) {
      setError(check.error ?? 'Invalid username.');
      return;
    }
    if (availability === 'taken') {
      setError('That username is already taken.');
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
        setError('That username is already taken.');
        setAvailability('taken');
      } else {
        setError(e instanceof Error ? e.message : 'Could not save the username.');
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [draft, availability, refreshProfile, onDone]);

  const hint = (() => {
    if (availability === 'checking') return 'Checking availability…';
    if (availability === 'available') {
      return '@' + validateUsername(draft).value + ' is available';
    }
    if (availability === 'taken') return 'That username is already taken';
    if (availability === 'error') return 'Could not check availability';
    return null;
  })();

  return (
    <KeyboardShift>
    <View style={styles.container}>
      <View style={styles.top}>
        <DuoOrbLogo size={64} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Choose your username</Text>
        <Text style={styles.subtitle}>
          This is how friends find and add you.
        </Text>

        <View style={styles.inputRow}>
          <Text style={styles.prefix}>@</Text>
          <TextInput
            style={styles.input}
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
          />
        </View>

        <Text style={styles.help}>
          Lowercase letters, numbers and _. {USERNAME_MAX} characters max.
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
          style={[styles.primary, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void save()}
        >
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Continue'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondary} onPress={onDone} disabled={saving}>
          <Feather name="arrow-right" size={15} color={THEME.colors.textMuted} />
          <Text style={styles.secondaryText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
    </KeyboardShift>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  top: {
    alignItems: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 22,
    letterSpacing: -0.3,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontFamily: THEME.fonts.medium,
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
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
    gap: 8,
  },
  primary: {
    height: 50,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: THEME.fonts.bold,
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
    opacity: 0.5,
  },
});
