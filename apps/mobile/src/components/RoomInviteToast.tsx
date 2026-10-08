import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RoomInviteDto } from '@duoorb/protocol';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { ToastAccept, ToastCard, ToastDecline, ToastOverlay } from './ui';

export const RoomInviteToast: React.FC<{
  invite: RoomInviteDto | null;
  notice?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ invite, notice, onAccept, onDecline }) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  if (!invite && !notice) return null;
  return (
    <ToastOverlay bottom={78}>
      <ToastCard radius={12} padding={12} borderColor={THEME.colors.surfaceHairline}>
        <View style={styles.row}>
          <Feather name="user-plus" size={18} color={THEME.colors.primary} />
          <View style={styles.copy}>
            <Text style={styles.title}>
              {invite
                ? invite.fromDisplayName
                  ? t('roomToast.invited', { name: invite.fromDisplayName })
                  : t('roomToast.invitedFriend')
                : t('roomToast.declined')}
            </Text>
            {invite && <Text style={styles.sub}>{t('roomToast.sub', { code: invite.code })}</Text>}
          </View>
          {invite && (
            <View style={styles.actions}>
              <ToastDecline label={t('challengeToast.decline')} onPress={onDecline} compact />
              <ToastAccept label={t('challengeToast.accept')} onPress={onAccept} />
            </View>
          )}
        </View>
      </ToastCard>
    </ToastOverlay>
  );
};

const createStyles = () => StyleSheet.create({
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
});
