import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RoomInviteDto } from '@duoorb/protocol';
import { THEME } from '../theme';

export const RoomInviteToast: React.FC<{
  invite: RoomInviteDto | null;
  notice?: string | null;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ invite, notice, onAccept, onDecline }) => {
  if (!invite && !notice) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.toast}>
        <Feather name="user-plus" size={18} color={THEME.colors.primary} />
        <View style={styles.copy}>
          <Text style={styles.title}>
            {invite ? `${invite.fromDisplayName || 'A friend'} invited you to a room` : 'Room invite declined'}
          </Text>
          {invite && <Text style={styles.sub}>Room {invite.code} · accept to join the lobby</Text>}
        </View>
        {invite && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, bottom: 78, zIndex: 100, elevation: 30 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    ...THEME.shadows.modal,
  },
  copy: { flex: 1 },
  title: { fontFamily: THEME.fonts.semiBold, fontSize: 13, color: '#0F172A', fontWeight: '600' },
  sub: { fontFamily: THEME.fonts.regular, fontSize: 11, color: '#64748B', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 6 },
  declineBtn: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9' },
  declineText: { fontFamily: THEME.fonts.semiBold, fontSize: 12, color: '#64748B' },
  acceptBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: THEME.colors.primary },
  acceptText: { fontFamily: THEME.fonts.bold, fontSize: 12, color: '#FFFFFF' },
});
