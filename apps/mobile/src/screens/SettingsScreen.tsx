import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { THEME, useStyles } from '../theme';
import { runWhenOnline } from '../components/NoConnection';
import { BlockedUsers } from '../components/BlockedUsers';
import { UserSettings } from '../storage/gameStorage';
import { useSession } from '../network/session';
import { isPremiumActive, refreshPremium, usePremium } from '../monetization/premium';
import { PREMIUM_GOLD } from '../components/PremiumBadge';
import { PremiumSheet } from '../components/PremiumSheet';
import { BOARD_SKINS, skinsUnlocked, type BoardSkinId } from '../theme/boardTheme';
import { api, ApiError } from '../network/apiClient';
import { NetworkError } from '../network/errors';
import { useTranslation } from '../i18n';
import { LanguageSelectModal } from '../components/LanguageSelectModal';
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

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onChange,
  onBack,
  onOpenLegal,
}) => {
  const styles = useStyles(createStyles);
  const { t, currentLanguage } = useTranslation();
  const [languageOpen, setLanguageOpen] = useState(false);

  const gameplayRows: ToggleRow[] = [
    {
      key: 'premoveEnabled',
      icon: 'corner-up-left',
      title: t('settings.premove'),
      desc: t('settings.premoveDesc'),
    },
    {
      key: 'extendedQueue',
      icon: 'grid',
      title: t('settings.wallPredrops'),
      desc: t('settings.wallPredropsDesc'),
    },
  ];

  const feedbackRows: ToggleRow[] = [
    {
      key: 'soundEnabled',
      icon: 'volume-2',
      title: t('settings.sounds'),
      desc: t('settings.soundsDesc'),
    },
    {
      key: 'testThink',
      icon: 'clock',
      title: t('settings.longAi'),
      desc: t('settings.longAiDesc'),
    },
  ];

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
  const premiumState = usePremium();
  // Premium membership itself (P7.3 card): strictly the live entitlement —
  // never a dev flag. Test purchases flow through here like production.
  const isPremiumMember = isPremiumActive(premiumState);
  const [premiumOpen, setPremiumOpen] = useState(false);
  // Paywall entry routing (P7.2): the card sells as "settings", a locked
  // board skin as "board-skin".
  const [premiumEntry, setPremiumEntry] = useState('settings');
  // Legally required cancel path (P7.3): Play Subscription Center always
  // handles cancel/plan/payment — never an in-app flow of our own.
  const openSubscriptionCenter = () => {
    void Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showBlocked, setShowBlocked] = useState(false);

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
      setUsernameError(check.error ?? t('username.invalid'));
      return;
    }
    if (check.value === currentUsername) {
      cancelUsernameEdit();
      return;
    }
    if (availability === 'taken') {
      setUsernameError(t('username.takenError'));
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
      // Transport died mid-save: runWhenOnline shows the dialog instead.
      if (e instanceof NetworkError) throw e;
      if (e instanceof ApiError && e.status === 409) {
        setUsernameError(t('username.takenError'));
        setAvailability('taken');
      } else {
        setUsernameError(e instanceof Error ? e.message : t('username.saveFailed'));
      }
    } finally {
      if (mounted.current) setSavingUsername(false);
    }
  }, [usernameDraft, currentUsername, availability, cancelUsernameEdit, refreshProfile, t]);

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
      setDisplayNameError(check.error ?? t('settings.invalidDisplayName'));
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
      // Transport died mid-save: runWhenOnline shows the dialog instead.
      if (e instanceof NetworkError) throw e;
      setDisplayNameError(e instanceof Error ? e.message : t('settings.displayNameSaveFailed'));
    } finally {
      if (mounted.current) setSavingDisplayName(false);
    }
  }, [displayNameDraft, currentDisplayName, cancelDisplayNameEdit, refreshProfile, t]);

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
      setDeleteError(e instanceof Error ? e.message : t('settings.deleteFailed'));
      setConfirmingDelete(false);
    } finally {
      if (mounted.current) setDeletingAccount(false);
    }
  }, [signOut, t]);

  const requestDeleteAccount = useCallback(() => {
    setDeleteError(null);
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    // Second tap: show the OS confirm as well so accidental taps cannot
    // wipe an account. The inline warning stays as the accessible record.
    const message = t('settings.deleteMessage');
    // Web browsers get the native confirm dialog: Alert.alert's custom dialog
    // never surfaces there, so the request below would never fire.
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(`${t('settings.deleteTitle')}\n\n${message}`)) void runDeleteAccount();
      return;
    }
    Alert.alert(
      t('settings.deleteTitle'),
      message,
      [
        { text: t('settings.keepAccount'), style: 'cancel', onPress: () => setConfirmingDelete(false) },
        {
          text: t('settings.deleteEverything'),
          style: 'destructive',
          onPress: () => void runDeleteAccount(),
        },
      ],
    );
  }, [confirmingDelete, runDeleteAccount, t]);

  const cancelDeleteAccount = useCallback(() => {
    setConfirmingDelete(false);
    setDeleteError(null);
  }, []);

  const availabilityHint = (() => {
    if (editingUsername) {
      const check = validateUsername(usernameDraft);
      if (check.ok && check.value === currentUsername) return t('username.current');
    }
    if (availability === 'checking') return t('username.checking');
    if (availability === 'available') {
      return t('username.available', { name: validateUsername(usernameDraft).value });
    }
    if (availability === 'taken') return t('username.taken');
    if (availability === 'error') return t('username.checkFailed');
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
        <TouchableOpacity
          style={[styles.toggleTrack, enabled && styles.toggleTrackOn]}
          activeOpacity={0.8}
          disabled={row.disabled}
          onPress={() => onChange({ [row.key]: !enabled } as Partial<UserSettings>)}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          accessibilityLabel={row.title}
        >
          <View style={[styles.toggleThumb, enabled && styles.toggleThumbOn]} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onBack}
          accessibilityLabel={t('common.back')}
        >
          <Feather name="arrow-left" size={20} color={THEME.colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account identity */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.account')}</Text>

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
                  ? t('settings.checkingSession')
                  : isGuest
                  ? t('settings.guestWarning')
                  : email ?? t('settings.signedIn')}
              </Text>
              {!!sessionError && <Text style={styles.errorText}>{sessionError}</Text>}
            </View>
          </View>
          <View style={styles.authRow}>
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
                  {signingIn ? '…' : t('settings.saveWithGoogle')}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.authButton} onPress={() => void signOut()}>
                <Text style={styles.authButtonText}>{t('settings.signOut')}</Text>
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
                  <Text style={styles.settingTitle}>{t('settings.email')}</Text>
                  <Text style={styles.settingDesc} numberOfLines={1}>
                    {email}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Premium (MONETIZATION.md P7.3): the manage/cancel path is legally
            required — premium members get the Play Subscription Center link
            right here, next to the upgrade entry. */}
        <LinearGradient
          colors={['#F7DE9B', '#D9A62E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, styles.premiumCard]}
        >
          <Text style={[styles.sectionLabel, styles.premiumLabel]}>{t('settings.premium')}</Text>
          {isPremiumMember ? (
            <View style={styles.settingRow}>
              <View style={[styles.settingIconBox, styles.premiumIconBox]}>
                <MaterialCommunityIcons name="crown" size={15} color={PREMIUM_GOLD} />
              </View>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, styles.premiumTitle]}>{t('settings.premiumActive')}</Text>
                <Text style={[styles.settingDesc, styles.premiumDesc]}>
                  {t('settings.premiumActiveDesc')}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() => {
                setPremiumEntry('settings');
                setPremiumOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.getPremium')}
            >
              <View style={[styles.settingIconBox, styles.premiumIconBox]}>
                <MaterialCommunityIcons name="crown" size={15} color={PREMIUM_GOLD} />
              </View>
              <View style={styles.settingText}>
                <Text style={[styles.settingTitle, styles.premiumTitle]}>{t('settings.getPremium')}</Text>
                <Text style={[styles.settingDesc, styles.premiumDesc]}>
                  {t('settings.getPremiumDesc', { price: '$3.99' })}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color="#3A2A00" />
            </TouchableOpacity>
          )}
          {isPremiumMember && (
            <>
              <View style={[styles.divider, styles.premiumDivider]} />
              <TouchableOpacity
                style={styles.settingRow}
                onPress={openSubscriptionCenter}
                accessibilityRole="button"
                accessibilityLabel={t('settings.manageSub')}
              >
                <View style={[styles.settingIconBox, styles.premiumIconBox]}>
                  <Feather name="settings" size={15} color={PREMIUM_GOLD} />
                </View>
                <View style={styles.settingText}>
                  <Text style={[styles.settingTitle, styles.premiumTitle]}>{t('settings.manageSub')}</Text>
                  <Text style={[styles.settingDesc, styles.premiumDesc]}>
                    {t('settings.manageSubDesc')}
                  </Text>
                </View>
                <Feather name="external-link" size={14} color="#3A2A00" />
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>

        <PremiumSheet
          visible={premiumOpen}
          entry={premiumEntry}
          onClose={() => setPremiumOpen(false)}
          onDone={() => {
            setPremiumOpen(false);
            void refreshPremium();
          }}
        />

        {/* Display name */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.displayName')}</Text>
          {!editingDisplayName ? (
            <View style={styles.settingRow}>
              <View style={styles.settingIconBox}>
                <Feather name="user" size={15} color={THEME.colors.textSecondary} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle} numberOfLines={1}>
                  {currentDisplayName}
                </Text>
                <Text style={styles.settingDesc}>{t('settings.displayNameDesc')}</Text>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={startDisplayNameEdit}
                accessibilityLabel={t('settings.editDisplayNameA11y')}
              >
                <Feather name="edit-2" size={14} color={THEME.colors.primary} />
                <Text style={styles.editButtonText}>{t('common.edit')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('settings.displayNamePlaceholder')}
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
                  onSubmitEditing={() => runWhenOnline(() => saveDisplayName())}
                />
                {!!displayNameError && (
                  <Text style={styles.errorText}>{displayNameError}</Text>
                )}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.primaryButton, savingDisplayName && styles.disabled]}
                    disabled={savingDisplayName}
                    onPress={() => runWhenOnline(() => saveDisplayName())}
                  >
                    <Text style={styles.primaryButtonText}>
                      {savingDisplayName ? t('common.saving') : t('common.save')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={cancelDisplayNameEdit}
                  >
                    <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
        </View>

        {/* Username */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.username')}</Text>
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
                      ? t('settings.usernameGenerated')
                      : t('settings.usernameDesc')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={startUsernameEdit}
                  accessibilityLabel={t('settings.editUsernameA11y')}
                >
                  <Feather name="edit-2" size={14} color={THEME.colors.primary} />
                  <Text style={styles.editButtonText}>{t('common.edit')}</Text>
                </TouchableOpacity>
              </View>
              {usingGeneratedUsername && (
                <View style={styles.ctaPill}>
                  <View style={styles.ctaDot} />
                  <Text style={styles.ctaText}>{t('settings.pickName')}</Text>
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
                  onSubmitEditing={() => runWhenOnline(() => saveUsername())}
                />
              </View>
              <Text style={styles.settingDesc}>
                {t('username.help', { max: USERNAME_MAX })}
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
                  onPress={() => runWhenOnline(() => saveUsername())}
                >
                  <Text style={styles.primaryButtonText}>
                    {savingUsername ? t('common.saving') : t('common.save')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={cancelUsernameEdit}>
                  <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Gameplay */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.gameplay')}</Text>
          {gameplayRows.map((row, i) => {
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

        {/* Privacy & safety — Blocked Users live here (and only here
            plus the Profile toggle), always reachable even when empty. */}
        {!isGuest && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.privacySafety')}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowBlocked((v) => !v)}
            accessibilityLabel={t('settings.blockedToggleA11y')}
            accessibilityRole="button"
          >
            <View style={styles.settingIconBox}>
              <Feather name="slash" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{t('settings.blockedUsers')}</Text>
              <Text style={styles.settingDesc}>{t('settings.blockedUsersDesc')}</Text>
            </View>
            <Feather
              name={showBlocked ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={THEME.colors.textMuted}
            />
          </TouchableOpacity>
          {showBlocked && (
            <>
              <View style={styles.divider} />
              <BlockedUsers />
            </>
          )}
        </View>
        )}

        {/* Feedback & testing */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.feedbackTesting')}</Text>
          {feedbackRows.map((row, i) => (
            <View key={row.key as string}>
              {i > 0 && <View style={styles.divider} />}
              {renderToggleRow(row)}
            </View>
          ))}
        </View>

        {/* Language */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('language.section')}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setLanguageOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('language.rowTitle')}
          >
            <View style={styles.flagIconBox}>
              <Text style={styles.flagEmoji}>{currentLanguage.flag}</Text>
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{currentLanguage.nativeName}</Text>
              <Text style={styles.settingDesc}>{currentLanguage.englishName}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={THEME.colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Appearance */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.appearance')}</Text>
          {renderToggleRow({
            key: 'darkMode',
            icon: 'moon',
            title: t('settings.darkMode'),
            desc: t('settings.darkModeDesc'),
          })}
        </View>

        {/* Board design: Classic free, Walnut/Glacier/Arena premium-gated.
            Locked tap opens the paywall; the board falls back to Classic
            for free/lapsed members, so selection never breaks rendering. */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.boardDesign')}</Text>
          {(
            [
              { id: 'classic', title: t('settings.boardClassic'), desc: t('settings.boardClassicDesc') },
              { id: 'walnut', title: t('settings.boardWalnut'), desc: t('settings.boardWalnutDesc') },
            ] as Array<{ id: BoardSkinId; title: string; desc: string }>
          ).map((option, index) => {
            const skin = BOARD_SKINS[option.id];
            const selected = (settings.boardSkinId ?? 'classic') === option.id;
            // Premium skins stay gated for everyone without a membership.
            const locked = skin.premiumOnly && !skinsUnlocked(isPremiumMember);
            return (
              <View key={option.id}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={() => {
                    if (locked) {
                      setPremiumEntry('board-skin');
                      setPremiumOpen(true);
                      return;
                    }
                    onChange({ boardSkinId: option.id });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${option.title}${locked ? `, ${t('settings.boardPremiumTag')}` : ''}`}
                >
                  <View
                    style={[
                      styles.skinSwatch,
                      { backgroundColor: skin.boardBackground, borderColor: skin.boardBorder },
                    ]}
                  >
                    <View
                      style={[
                        styles.skinSwatchCell,
                        { backgroundColor: skin.cell, borderColor: skin.cellBorder },
                      ]}
                    />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>{option.title}</Text>
                    <Text style={styles.settingDesc}>{option.desc}</Text>
                  </View>
                  {locked ? (
                    <View style={styles.skinLock}>
                      <MaterialCommunityIcons name="crown" size={13} color={PREMIUM_GOLD} />
                      <Text style={styles.skinLockText}>{t('settings.boardPremiumTag')}</Text>
                    </View>
                  ) : (
                    selected && (
                      <Feather name="check-circle" size={18} color={THEME.colors.primary} />
                    )
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Legal - native in-app reader (offline). Web version linked inside. */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('settings.legal')}</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('privacy')}
            accessibilityLabel={t('settings.privacyPolicy')}
          >
            <View style={styles.settingIconBox}>
              <Feather name="shield" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{t('settings.privacyPolicy')}</Text>
              <Text style={styles.settingDesc}>{t('settings.privacyPolicyDesc')}</Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('terms')}
            accessibilityLabel={t('settings.terms')}
          >
            <View style={styles.settingIconBox}>
              <Feather name="file-text" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{t('settings.terms')}</Text>
              <Text style={styles.settingDesc}>{t('settings.termsDesc')}</Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => onOpenLegal?.('delete')}
            accessibilityLabel={t('settings.deleteData')}
          >
            <View style={styles.settingIconBox}>
              <Feather name="trash-2" size={15} color={THEME.colors.textSecondary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{t('settings.deleteData')}</Text>
              <Text style={styles.settingDesc} numberOfLines={2}>
                {t('settings.deleteDataDesc')}
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={THEME.colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.supportText}>{t('settings.support', { email: LEGAL_CONTACT_EMAIL })}</Text>
        </View>

        {/* Danger zone - Play Account Deletion requirement. */}
        <View style={[styles.card, styles.dangerCard]}>
          <Text style={[styles.sectionLabel, styles.dangerLabel]}>{t('settings.dangerZone')}</Text>
          {!confirmingDelete ? (
            <>
              <Text style={styles.settingDesc}>
                {t('settings.dangerDesc')}
              </Text>
              <TouchableOpacity
                style={[styles.dangerButton, deletingAccount && styles.disabled]}
                disabled={deletingAccount}
                onPress={requestDeleteAccount}
                accessibilityLabel={t('settings.deleteData')}
              >
                <Feather name="trash-2" size={14} color="#fff" />
                <Text style={styles.dangerButtonText}>
                  {deletingAccount ? t('settings.deleting') : t('settings.deleteData')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dangerWarning}>
                {t('settings.confirmDelete', { who: currentUsername ? `@${currentUsername}` : t('settings.thisAccount') })}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.dangerButton, styles.dangerButtonFlex, deletingAccount && styles.disabled]}
                  disabled={deletingAccount}
                  onPress={requestDeleteAccount}
                >
                  <Text style={styles.dangerButtonText}>
                    {deletingAccount ? t('settings.deleting') : t('settings.yesDelete')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, styles.dangerButtonFlex]} onPress={cancelDeleteAccount}>
                  <Text style={styles.secondaryButtonText}>{t('settings.keepAccount')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {!!deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
        </View>
      </ScrollView>

      <LanguageSelectModal
        visible={languageOpen}
        onClose={() => setLanguageOpen(false)}
      />
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: THEME.fonts.extraBold,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: THEME.colors.onSurface,
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  premiumCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  // Dark ink + tile for everything sitting on the solid gold card.
  premiumLabel: {
    color: '#3A2A00',
  },
  premiumIconBox: {
    backgroundColor: '#3A2A00',
  },
  premiumTitle: {
    color: '#3A2A00',
  },
  premiumDesc: {
    color: '#3A2A00',
    opacity: 0.8,
  },
  premiumDivider: {
    backgroundColor: '#3A2A00',
    opacity: 0.25,
  },
  sectionLabel: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: THEME.colors.textMuted,
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.dividerSoft,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  // Custom toggle: full visual control (never the platform default),
  // white thumb gliding on a primary track when on.
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.colors.surfaceDim,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  toggleTrackOn: {
    backgroundColor: THEME.colors.primary,
    alignItems: 'flex-end',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    ...THEME.shadows.card,
  },
  toggleThumbOn: {},
  settingRowDisabled: {
    opacity: 0.45,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfacePrimaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Board skin preview: frame color outside, one cell inside.
  skinSwatch: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinSwatchCell: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
  },
  skinLock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skinLockText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 10,
    color: PREMIUM_GOLD,
    letterSpacing: 0.5,
  },
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 22,
    color: THEME.colors.primary,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  authRow: {
    paddingBottom: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
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
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputPrefix: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  input: {
    flex: 1,
    fontFamily: THEME.fonts.semiBold,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: THEME.colors.textPrimary,
    fontSize: 15,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 12,
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
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.onPrimary,
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.outlineVariant,
    backgroundColor: THEME.colors.backgroundCard,
  },
  secondaryButtonText: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
  },
  settingText: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    color: THEME.colors.textPrimary,
  },
  settingDesc: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    lineHeight: 17,
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
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
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
    paddingVertical: 13,
    borderRadius: 12,
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
  flagIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: {
    fontSize: 20,
  },
});
