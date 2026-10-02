import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { LEGAL_CONTACT_EMAIL } from '../legal';
import type { LegalKind } from '../legal-content';
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
  /** Opens the native in-app legal reader (offline-capable). */
  onOpenLegal?: (kind: LegalKind) => void;
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
  onOpenLegal,
}) => {
  const {
    identity,
    profileLoading,
    loading: sessionLoading,
    signingIn,
    error: sessionError,
    signInWithGoogle,
    signOut,
    refreshProfile,
    supabaseUser,
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

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const availabilityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (availabilityTimer.current) clearTimeout(availabilityTimer.current);
    };
  }, []);

  const isGuest = identity?.isGuest ?? true;
  // The canonical identity is the only source: Profile, Settings and the
  // socket all resolve the same userId and the same server-confirmed names.
  const currentUsername = identity?.username ?? null;
  const currentDisplayName = identity?.displayName ?? '';
  // Email belongs to the sign-in provider, so it comes from the account
  // session — never from the guest identity, which has no address.
  const email = supabaseUser?.email;
  // The handle is only "generated" if it is exactly what the server seeds for
  // this id, so a name the player deliberately chose is never flagged.
  const usingGeneratedUsername = isGeneratedUsername(currentUsername, identity?.userId ?? '');

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

  const runDeleteAccount = useCallback(async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await api.deleteAccount();
      // Server deleted the rows + revoked tokens. Sign out wipes the
      // device (identity, socket, onboarding) and returns to Welcome.
      await signOut();
    } catch (e) {
      if (!mounted.current) return;
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the account.');
      setConfirmingDelete(false);
    } finally {
      if (mounted.current) setDeletingAccount(false);
    }
  }, [signOut]);

  const requestDeleteAccount = useCallback(() => {
    setDeleteError(null);
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    // Second tap: show the OS confirm as well so accidental taps cannot
    // wipe an account. The inline warning stays as the accessible record.
    const message =
      'This permanently deletes your profile, rating, history, friends and achievements. This cannot be undone.';
    // Web browsers get the native confirm dialog: Alert.alert's custom dialog
    // never surfaces there, so the request below would never fire.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`Delete account?\n\n${message}`)) void runDeleteAccount();
      return;
    }
    Alert.alert(
      'Delete account?',
      message,
      [
        { text: 'Keep my account', style: 'cancel', onPress: () => setConfirmingDelete(false) },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => void runDeleteAccount(),
        },
      ],
    );
  }, [confirmingDelete, runDeleteAccount]);

  const cancelDeleteAccount = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
  }, []);

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
          <Feather name="arrow-left" size={20} color={THEME.colors.slate[700]} />
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
              <Text style={[styles.settingDesc, isGuest && styles.guestWarning]} numberOfLines={1}>
                {sessionLoading
                  ? 'Checking session…'
                  : isGuest
                  ? 'Unsaved progress — reinstall = lost'
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
                  {signingIn ? '…' : 'Save with Google'}
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

        {/* Legal - native in-app reader (offline). Web version linked inside. */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LEGAL</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('privacy')}
            accessibilityLabel="Open Privacy Policy"
          >
            <View style={styles.settingIconBox}>
              <Feather name="shield" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Privacy Policy</Text>
              <Text style={styles.settingDesc}>What we collect, why, and your rights.</Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('terms')}
            accessibilityLabel="Open Terms of Service"
          >
            <View style={styles.settingIconBox}>
              <Feather name="file-text" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Terms of Service</Text>
              <Text style={styles.settingDesc}>Fair play, content rules, reporting.</Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('delete')}
            accessibilityLabel="Open Delete Account help"
          >
            <View style={styles.settingIconBox}>
              <Feather name="trash-2" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Delete account &amp; data</Text>
              <Text style={styles.settingDesc} numberOfLines={2}>
                How deletion works, including the web request (no app needed).
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.supportText}>DuoOrb by AS Digital · Support: {LEGAL_CONTACT_EMAIL}</Text>
        </View>

        {/* Danger zone - Play Account Deletion requirement. */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.sectionLabel, styles.dangerLabel]}>DANGER ZONE</Text>
          {!confirmingDelete ? (
            <>
              <Text style={styles.settingDesc}>
                Permanently deletes your profile, rating, history, friends and achievements. Cannot
                be undone. Guests and Google accounts both use this.
              </Text>
              <TouchableOpacity
                style={[styles.dangerButton, deletingAccount && styles.disabled]}
                disabled={deletingAccount}
                onPress={requestDeleteAccount}
                accessibilityLabel="Delete account and data"
              >
                <Feather name="trash-2" size={14} color="#fff" />
                <Text style={styles.dangerButtonText}>
                  {deletingAccount ? 'Deleting…' : 'Delete account & data'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dangerWarning}>
                Are you sure? This wipes everything linked to{' '}
                {currentUsername ? `@${currentUsername}` : 'this account'} and signs this device
                out. Tap Delete to get a final system confirm.
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.dangerButton, styles.dangerButtonFlex, deletingAccount && styles.disabled]}
                  disabled={deletingAccount}
                  onPress={requestDeleteAccount}
                >
                  <Text style={styles.dangerButtonText}>
                    {deletingAccount ? 'Deleting…' : 'Yes, delete'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, styles.dangerButtonFlex]} onPress={cancelDeleteAccount}>
                  <Text style={styles.secondaryButtonText}>Keep my account</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
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
    backgroundColor: THEME.colors.dividerSoft,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
    color: THEME.colors.onPrimary,
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
  // Guest identity line: reads as a warning, not information.
  guestWarning: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.warning,
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
    backgroundColor: THEME.colors.surfaceMuted,
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
    color: THEME.colors.onPrimary,
  },
  disabled: {
    opacity: 0.35,
  },
  supportText: {
    fontFamily: THEME.fonts.regular,
    fontSize: 11,
    color: THEME.colors.textMuted,
    paddingVertical: 10,
  },
  dangerCard: {
    borderColor: THEME.colors.danger,
  },
  dangerLabel: {
    color: THEME.colors.danger,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: THEME.colors.danger,
    paddingVertical: 12,
    borderRadius: THEME.radius.md,
  },
  dangerButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  dangerButtonText: {
    fontFamily: THEME.fonts.bold,
    color: '#fff',
    fontSize: 13,
  },
  dangerWarning: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: THEME.colors.danger,
    paddingVertical: 8,
  },
});
