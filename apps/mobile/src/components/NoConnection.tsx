import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { NetworkError } from '../network/errors';

/** Whose fault it is: the device connection or our servers. */
export type NoConnectionKind = 'offline' | 'server';

/** Guest blue for the retry/OK buttons. */
const BLUE_600 = '#2563eb';

/**
 * Full-section offline/server state for every screen that needs internet
 * (Friends, History, Profile, Leaderboard, boot). Centered cloud-off icon,
 * plain title, one blue Retry button — no red, no banner pushing layout.
 * Same design for both kinds, different message.
 */
export const NoConnectionSection: React.FC<{
  kind: NoConnectionKind;
  /** Overrides the default message (e.g. a server refusal reason). */
  message?: string;
  onRetry: () => void;
}> = ({ kind, message, onRetry }) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Feather name="cloud-off" size={48} color={THEME.colors.textMuted} />
      <Text style={styles.sectionTitle}>{t('connection.noConnection')}</Text>
      <Text style={styles.sectionMessage}>
        {message ??
          (kind === 'offline'
            ? t('connection.offlineMessage')
            : t('connection.serverMessage'))}
      </Text>
      <TouchableOpacity
        style={styles.retryBtn}
        activeOpacity={0.85}
        onPress={onRetry}
        accessibilityLabel={t('connection.retry')}
        accessibilityRole="button"
      >
        <Text style={styles.retryText}>{t('connection.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
};

type OfflineListener = (kind: NoConnectionKind) => void;
const offlineListeners = new Set<OfflineListener>();

/**
 * One-shot offline dialog for action buttons (Quick Match, Create Room,
 * Join, friend search, …). Mount `<OfflineModal />` once in App; any button
 * calls `offlineAlert.show('offline')` instead of firing into the void.
 */
export const offlineAlert = {
  show(kind: NoConnectionKind): void {
    for (const fn of offlineListeners) {
      try {
        fn(kind);
      } catch {
        // A dialog listener must never break the caller.
      }
    }
  },
};

export const OfflineModal: React.FC = () => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const [kind, setKind] = useState<NoConnectionKind | null>(null);

  useEffect(() => {
    const onAlert = (k: NoConnectionKind) => setKind(k);
    offlineListeners.add(onAlert);
    return () => {
      offlineListeners.delete(onAlert);
    };
  }, []);

  return (
    <Modal
      visible={kind !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setKind(null)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Feather name="cloud-off" size={40} color={THEME.colors.textMuted} />
          <Text style={styles.cardTitle}>
            {kind === 'offline' ? t('connection.youAreOffline') : t('connection.sorry')}
          </Text>
          <Text style={styles.cardMessage}>
            {kind === 'offline'
              ? t('connection.checkInternet')
              : t('connection.serverBroke')}
          </Text>
          <TouchableOpacity
            style={styles.okBtn}
            activeOpacity={0.85}
            onPress={() => setKind(null)}
            accessibilityLabel={t('connection.ok')}
            accessibilityRole="button"
          >
            <Text style={styles.okText}>{t('connection.ok')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Gate for buttons that need internet. Checks the real connectivity state
 * first: offline shows the dialog without firing. If the action itself dies
 * in transport (device online but nothing loads — dead server, DNS,
 * CORS-blocked web dev), the dialog shows too, blamed by what the OS
 * believes. Anything else was already handled by the action's own catch.
 */
export function runWhenOnline(action: () => void | Promise<unknown>): void {
  void (async () => {
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected === false) {
        offlineAlert.show('offline');
        return;
      }
    } catch {
      // Unknown state: let the action try; failures surface below.
    }
    try {
      await action();
    } catch (e) {
      if (e instanceof NetworkError) {
        try {
          const state = await NetInfo.fetch();
          offlineAlert.show(state.isConnected === false ? 'offline' : 'server');
        } catch {
          offlineAlert.show('offline');
        }
      }
      // Anything else was already handled by the action's own catch.
    }
  })();
}

const createStyles = () => StyleSheet.create({
  // Full-section state: centers itself wherever it replaces content.
  section: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 20,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  sectionMessage: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 6,
    height: 36,
    borderRadius: THEME.radius.md,
    backgroundColor: BLUE_600,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  // Modal dialog for action buttons.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.boardBorder,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...THEME.shadows.modal,
  },
  cardTitle: {
    fontFamily: THEME.fonts.bold,
    fontSize: 18,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  cardMessage: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  okBtn: {
    marginTop: 6,
    height: 48,
    width: '100%',
    borderRadius: THEME.radius.md,
    backgroundColor: BLUE_600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
