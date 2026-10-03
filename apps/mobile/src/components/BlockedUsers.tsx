import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import { api } from '../network/apiClient';
import { toast } from './AppToast';
import { actionMessage } from '../network/errors';

interface BlockedEntry {
  id: string;
  username: string;
  displayName: string;
}

/**
 * Blocked Users list, hosted under Settings → Privacy & Safety. Always
 * reachable (even with zero blocked users) so the empty state — not an
 * absent entry — is what an unblocked player sees.
 *
 * Unblock lives here and on the Profile toggle; blocking itself lives ONLY
 * on Profiles, never on list rows.
 */
export const BlockedUsers: React.FC = () => {
  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setEntries(await api.getBlocked());
    } catch (e) {
      setLoadFailed(true);
      toast.show(actionMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnblock = useCallback(async (userId: string) => {
    if (unblocking) return;
    setUnblocking(userId);
    try {
      await api.unblockUser(userId);
      setEntries((prev) => prev.filter((b) => b.id !== userId));
    } catch (e) {
      toast.show(actionMessage(e));
    } finally {
      setUnblocking(null);
    }
  }, [unblocking]);

  if (loading) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="small" color={THEME.colors.textSecondary} />
      </View>
    );
  }

  if (loadFailed && entries.length === 0) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.emptyTitle}>COULD NOT LOAD</Text>
        <Text style={styles.emptySub}>Check your connection and try again.</Text>
        <TouchableOpacity style={styles.retryBtn} activeOpacity={0.7} onPress={() => void load()}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centerWrap}>
        <View style={styles.iconCircle}>
          <Feather name="slash" size={26} color={THEME.colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>NO BLOCKED USERS</Text>
        <Text style={styles.emptySub}>
          Players you block from their profile will appear here. Blocked players cannot match, challenge or message you.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {entries.map((b) => (
        <View key={b.id} style={styles.row}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarInitial}>
              {(b.displayName || b.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {b.displayName || b.username}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>@{b.username}</Text>
          </View>
          <TouchableOpacity
            style={styles.unblockBtn}
            activeOpacity={0.7}
            disabled={unblocking === b.id}
            onPress={() => void handleUnblock(b.id)}
            accessibilityLabel={`Unblock ${b.username}`}
            accessibilityRole="button"
          >
            <Text style={styles.unblockText}>
              {unblocking === b.id ? '…' : 'Unblock'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  centerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: THEME.fonts.regular,
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: 8,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    backgroundColor: THEME.colors.backgroundCard,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.backgroundCard,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    borderRadius: THEME.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
  },
  avatarInitial: {
    fontFamily: THEME.fonts.bold,
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  meta: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    color: THEME.colors.textPrimary,
  },
  handle: {
    fontFamily: THEME.fonts.regular,
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  unblockBtn: {
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceHairline,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unblockText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
});
