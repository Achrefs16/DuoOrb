import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RoomInviteDto } from '@duoorb/protocol';
import { THEME } from '../theme';
import { createThemedStyles } from '../theme/themedStyles';
import { ToastAccept, ToastCard, ToastDecline, ToastOverlay } from './ui';

export const RoomInviteToast: React.FC<{
  invite: RoomInviteDto | null;
  notice?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ invite, notice, onAccept, onDecline }) => {
  if (!invite && !notice) return null;
  return (
    <ToastOverlay bottom={78}>
      <ToastCard radius={12} padding={12} borderColor={THEME.colors.surfaceHairline}>
        <View style={styles.row}>
          <Feather name="user-plus" size={18} color={THEME.colors.primary} />
          <View style={styles.copy}>
            <Text style={styles.title}>
              {invite
                ? `${invite.fromDisplayName || 'A friend'} invited you to a room`
                : 'Room invite declined'}
            </Text>
            {invite && <Text style={styles.sub}>Room {invite.code} · accept to join the lobby</Text>}
          </View>
          {invite && (
            <View style={styles.actions}>
              <ToastDecline label="Decline" onPress={onDecline} compact />
              <ToastAccept label="Accept" onPress={onAccept} />
            </View>
          )}
        </View>
      </ToastCard>
    </ToastOverlay>
  );
};

const styles = createThemedStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1 },
  title: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 13,
    color: THEME.colors.inverseLabel,
    fontWeight: '600',
  },
  sub: { fontFamily: THEME.fonts.regular, fontSize: 11, color: THEME.colors.textSecondaryStrong, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
}));
