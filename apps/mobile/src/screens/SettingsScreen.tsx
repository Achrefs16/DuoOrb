import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { UserSettings } from '../storage/gameStorage';
import { useSession } from '../network/session';
import { api, ApiError } from '../network/apiClient';
import {
  isGeneratedUsername,
  sanitizeUsernameInput,
  validateDisplayName,
  validateUsername,
  DISPLAY_NAME_MAX,
  USERNAME_MAX,
} from '../usernamePolicy';

interface SettingsScreenProps {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings>) => void;
  onBack: () => void;
}

interface ToggleRow {
  key: keyof UserSettings;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  desc: string;
  disabled?: boolean;
}

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'error';

const GAMEPLAY_ROWS: ToggleRow[] = [
  {
    key: 'premoveEnabled',
    icon: 'corner-up-left',
    title: 'Premove',
    desc: 'Plan your next move while the AI or your opponent is still thinking',
  },
  {
    key: 'extendedQueue',
    icon: 'grid',
    title: 'Wall pre-drops',
    desc: 'Chain several moves in a row and queue walls while you wait',
  },
  {
    key: 'autoFlip',
    icon: 'rotate-cw',
    title: 'Auto-flip board',
    desc: 'Rotate for each side in local 1v1',
  },
];

const APPEARANCE_ROWS: ToggleRow[] = [
  {
    key: 'soundEnabled',
    icon: 'volume-2',
    title: 'Sounds',
    desc: 'Move, wall and goal effects',
  },
  {
    key: 'testThink',
    icon: 'clock',
    title: 'Long AI pause',
    desc: '10 seconds per AI turn, for testing',
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onChange,
  onBack,
}) => {
  const {
    identity,
    profile,
    profileLoading,
    loading: sessionLoading,
    signingIn,
    error: sessionError,
    signInWithGoogle,
    signOut,
    refreshProfile,
  } = useSession();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [availability, setAvailability] = useState<Availability>('idle');

  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const availabilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
    };
  }, []);

  const isGuest = identity.isGuest;
  const currentUsername = profile?.username ?? null;
  const currentDisplayName = profile?.displayName ?? identity.displayName;
  const email = identity.email;
  // The handle is only "generated" if it is exactly what the server seeds for
  // this id, so a name the player deliberately chose is never flagged.
  const usingGeneratedUsername = isGeneratedUsername(currentUsername, identity.userId);

  // Live availability probe for a well-formed handle that differs from the
  // saved one, debounced so typing does not spam the endpoint. State resets
  // happen in the open/close handlers, never in the effect body.
  useEffect(() => {
    if (!editingUsername) return;
    if (availabilityTimer.current) clearTimeout(availabilityTimer.current);

    const check = validateUsername(usernameDraft);
    if (!check.ok || check.value === currentUsername) return;

    availabilityTimer.current = setTimeout(async () => {
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
      if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
    };
  }, [editingUsername, usernameDraft, currentUsername]);

  const startUsernameEdit = useCallback(() => {
    setUsernameDraft(currentUsername ?? '');
    setUsernameError(null);
    setAvailability('idle');
    setEditingUsername(true);
  }, [currentUsername]);

  const cancelUsernameEdit = useCallback(() => {
    setEditingUsername(false);
    setUsernameDraft('');
    setUsernameError(null);
    setAvailability('idle');
  }, []);

  const saveUsername = useCallback(async () => {
    const check = validateUsername(usernameDraft);
    if (!check.ok) {
      setUsernameError(check.error ?? 'Invalid username.');
      return;
    }
    if (check.value === currentUsername) {
      cancelUsernameEdit();
      return;
    }
    if (availability === 'taken') {
      setUsernameError('That username is already taken.');
      return;
    }

    setSavingUsername(true);
    setUsernameError(null);
    try {
      await api.updateUsername(check.value);
      await refreshProfile();
      if (!mounted.current) return;
      cancelUsernameEdit();
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 409) {
        setUsernameError('That username is already taken.');
        setAvailability('taken');
      } else {
        setUsernameError(e instanceof Error ? e.message : 'Could not save the username.');
      }
    } finally {
      if (mounted.current) setSavingUsername(false);
    }
  }, [usernameDraft, currentUsername, availability, cancelUsernameEdit, refreshProfile]);

  const startDisplayNameEdit = useCallback(() => {
    setDisplayNameDraft(currentDisplayName);
    setDisplayNameError(null);
    setEditingDisplayName(true);
  }, [currentDisplayName]);

  const cancelDisplayNameEdit = useCallback(() => {
    setEditingDisplayName(false);
    setDisplayNameDraft('');
    setDisplayNameError(null);
  }, []);

  const saveDisplayName = useCallback(async () => {
    const check = validateDisplayName(displayNameDraft);
    if (!check.ok) {
      setDisplayNameError(check.error ?? 'Invalid display name.');
      return;
    }
    if (check.value === currentDisplayName) {
      cancelDisplayNameEdit();
      return;
    }

    setSavingDisplayName(true);
    setDisplayNameError(null);
    try {
      await api.updateDisplayName(check.value);
      await refreshProfile();
      if (!mounted.current) return;
      cancelDisplayNameEdit();
    } catch (e) {
      if (!mounted.current) return;
      setDisplayNameError(e instanceof Error ? e.message : 'Could not save the display name.');
    } finally {
      if (mounted.current) setSavingDisplayName(false);
    }
  }, [displayNameDraft, currentDisplayName, cancelDisplayNameEdit, refreshProfile]);

  const availabilityHint = (() => {
    if (editingUsername) {
      const check = validateUsername(usernameDraft);
      if (check.ok && check.value === currentUsername) return 'This is your current username';
    }
    if (availability === 'checking') return 'Checking availability…';
    if (availability === 'available') {
      return '@' + validateUsername(usernameDraft).value + ' is available';
    }
    if (availability === 'taken') return 'That username is already taken';
    if (availability === 'error') return 'Could not check availability';
    return null;
  })();

  const renderToggleRow = (row: ToggleRow) => {
    const enabled = Boolean(settings[row.key]);
    return (
      <View style={[styles.settingRow, row.disabled && styles.settingRowDisabled]}>
        <View style={styles.settingIconBox}>
          <Feather name={row.icon} size={15} color={THEME.colors.textSecondary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{row.title}</Text>
          <Text style={styles.settingDesc}>{row.desc}</Text>
        </View>
        <Switch
          value={enabled}
          disabled={row.disabled}
          onValueChange={(v) => onChange({ [row.key]: v } as Partial<UserSettings>)}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onBack}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color="#334155" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account identity */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>

          <View style={styles.identityRow}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarInitial}>
                {(currentDisplayName || 'Y').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle} numberOfLines={1}>
                {currentDisplayName}
              </Text>
              <Text style={styles.settingDesc} numberOfLines={1}>
                {sessionLoading
                  ? 'Checking session…'
                  : isGuest
                  ? 'Guest — progress stays on this device'
                  : email ?? 'Signed in'}
              </Text>
              {!!sessionError && <Text style={styles.errorText}>{sessionError}</Text>}
            </View>
            {profileLoading ? (
              <ActivityIndicator size="small" />
            ) : sessionLoading ? (
              <ActivityIndicator />
            ) : isGuest ? (
              <TouchableOpacity
                style={[styles.authButton, styles.authButtonPrimary, signingIn && styles.disabled]}
                disabled={signingIn}
                onPress={() => void signInWithGoogle()}
              >
                <Text style={styles.authButtonPrimaryText}>
                  {signingIn ? '…' : 'Sign in'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.authButton} onPress={() => void signOut()}>
                <Text style={styles.authButtonText}>Sign out</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Email is read-only: it belongs to the sign-in provider. */}
          {!isGuest && !!email && (
            <>
              <View style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingIconBox}>
                  <Feather name="mail" size={15} color={THEME.colors.textSecondary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Email</Text>
                  <Text style={styles.settingDesc} numberOfLines={1}>
                    {email}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Display name */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
          {!editingDisplayName ? (
            <View style={styles.settingRow}>
              <View style={styles.settingIconBox}>
                <Feather name="user" size={15} color={THEME.colors.textSecondary} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle} numberOfLines={1}>
                  {currentDisplayName}
                </Text>
                <Text style={styles.settingDesc}>The name opponents see in a match.</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={startDisplayNameEdit}
                accessibilityLabel="Edit display name"
              >
                <Feather name="edit-2" size={14} color={THEME.colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={displayNameDraft}
                  onChangeText={(t) => {
                    setDisplayNameDraft(t);
                    setDisplayNameError(null);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={DISPLAY_NAME_MAX}
                  returnKeyType="done"
                  onSubmitEditing={() => void saveDisplayName()}
                />
                {!!displayNameError && (
                  <Text style={styles.errorText}>{displayNameError}</Text>
                )}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, savingDisplayName && styles.disabled]}
                    disabled={savingDisplayName}
                    onPress={() => void saveDisplayName()}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingDisplayName ? 'Saving…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={cancelDisplayNameEdit}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
        </View>

        {/* Username */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>USERNAME</Text>
          {!editingUsername ? (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingIconBox}>
                  <Feather name="at-sign" size={15} color={THEME.colors.textSecondary} />
                </View>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle} numberOfLines={1}>
                    {currentUsername ? `@${currentUsername}` : '—'}
                  </Text>
                <Text style={styles.settingDesc}>
                  {usingGeneratedUsername
                    ? 'Generated for you. Pick your own — friends add you by it.'
                    : 'Friends add you by this name.'}
                </Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={startUsernameEdit}
                  accessibilityLabel="Edit username"
                >
                  <Feather name="edit-2" size={14} color={THEME.colors.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {usingGeneratedUsername && (
                <View style={styles.ctaPill}>
                  <View style={styles.ctaDot} />
                  <Text style={styles.ctaText}>PICK A NAME</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefix}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="yourname"
                  placeholderTextColor={THEME.colors.textMuted}
                  value={usernameDraft}
                  onChangeText={(t) => {
                    setUsernameDraft(sanitizeUsernameInput(t));
                    setUsernameError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={USERNAME_MAX}
                  returnKeyType="done"
                  onSubmitEditing={() => void saveUsername()}
                />
              </View>
              <Text style={styles.settingDesc}>
                Lowercase letters, numbers and _. {USERNAME_MAX} characters max.
              </Text>
              {!!availabilityHint && (
                <Text
                  style={[
                    styles.statusText,
                    availability === 'available' && styles.statusOk,
                    availability === 'taken' && styles.statusBad,
                  ]}
                >
                  {availabilityHint}
                </Text>
              )}
              {!!usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, savingUsername && styles.disabled]}
                  disabled={savingUsername}
                  onPress={() => void saveUsername()}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingUsername ? 'Saving…' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={cancelUsernameEdit}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Gameplay */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>GAMEPLAY</Text>
          {GAMEPLAY_ROWS.map((row, i) => {
            const disabled = row.key === 'extendedQueue' && !settings.premoveEnabled;
            const resolved = disabled ? { ...row, disabled: true } : row;
            return (
              <View key={row.key as string}>
                {i > 0 && <View style={styles.divider} />}
                {renderToggleRow(resolved)}
              </View>
            );
          })}
        </View>

        {/* Feedback & testing */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>FEEDBACK &amp; TESTING</Text>
          {APPEARANCE_ROWS.map((row, i) => (
            <View key={row.key as string}>
              {i > 0 && <View style={styles.divider} />}
              {renderToggleRow(row)}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.surfaceContainer,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.onSurface,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: THEME.colors.textMuted,
    paddingBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEF1F6',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  settingRowDisabled: {
    opacity: 0.45,
  },
  settingIconBox: {
    width: 32,
    height: 32,
    borderRadius: THEME.radius.sm,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.lg,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 16,
    color: THEME.colors.primary,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: '#F1F5F9',
  },
  editButtonText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    color: THEME.colors.primary,
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: THEME.radius.xs,
    backgroundColor: THEME.colors.primaryLight,
  },
  ctaDot: {
    width: 5,
    height: 5,
    backgroundColor: THEME.colors.primary,
  },
  ctaText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 9,
    letterSpacing: 1,
    color: THEME.colors.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    paddingHorizontal: 12,
  },
  inputPrefix: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  input: {
    flex: 1,
    fontFamily: THEME.fonts.semiBold,
    paddingVertical: 11,
    paddingHorizontal: 12,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
  },
  statusText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 6,
  },
  statusOk: {
    color: THEME.colors.success,
  },
  statusBad: {
    color: THEME.colors.danger,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    fontSize: 13,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: THEME.colors.backgroundCard,
  },
  secondaryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 13,
  },
  settingText: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  settingDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: THEME.colors.textSecondary,
  },
  errorText: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: THEME.colors.danger,
    marginTop: 2,
  },
  authButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  authButtonPrimary: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  authButtonText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  authButtonPrimaryText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.35,
  },
});
