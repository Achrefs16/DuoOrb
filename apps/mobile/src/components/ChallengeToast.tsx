import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ChallengeDto } from '@duoorb/protocol';
import { THEME } from '../theme';
import { modeLabel } from '../matchModes';
import { OutgoingChallenge } from '../network/useChallenge';

interface ChallengeToastProps {
  incoming: ChallengeDto | null;
  outgoing: OutgoingChallenge | null;
  notice: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancelWaiting: () => void;
}

function clockLabel(minutes: number, incrementSeconds: number): string {
  return `${minutes}+${incrementSeconds}`;
}

const AnimatedCard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 70,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const ChallengeToast: React.FC<ChallengeToastProps> = ({
  incoming,
  outgoing,
  notice,
  onAccept,
  onDecline,
  onCancelWaiting,
}) => {
  if (!incoming && !outgoing && !notice) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* Incoming challenge — Accept starts the game, Decline stops it. */}
      {incoming && (
        <AnimatedCard>
          <View style={styles.topRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(incoming.fromDisplayName || 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                {incoming.fromDisplayName}
              </Text>
              <Text style={styles.sub}>wants to play you</Text>
            </View>
            <View style={styles.swords}>
              <MaterialCommunityIcons name="sword-cross" size={20} color="#2563EB" />
            </View>
          </View>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{modeLabel(incoming.mode)}</Text>
            </View>
            <View style={styles.pill}>
              <Feather name="clock" size={11} color="#475569" />
              <Text style={styles.pillText}>
                {clockLabel(incoming.timeControlMinutes, incoming.incrementSeconds)}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {incoming.wallsEach >= 99 ? '∞ walls' : `${incoming.wallsEach} walls`}
              </Text>
            </View>
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Feather name="check" size={15} color="#FFFFFF" />
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>
      )}

      {/* Outgoing — waiting with cancel. */}
      {!incoming && outgoing && (
        <AnimatedCard>
          <View style={styles.topRow}>
            <ActivityIndicator size="small" color="#2563EB" />
            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={1}>
                Waiting for {outgoing.toName}…
              </Text>
              <Text style={styles.sub}>
                {modeLabel(outgoing.challenge.mode)} ·{' '}
                {clockLabel(
                  outgoing.challenge.timeControlMinutes,
                  outgoing.challenge.incrementSeconds
                )}
              </Text>
            </View>
            <TouchableOpacity style={styles.declineBtn} onPress={onCancelWaiting}>
              <Text style={styles.declineText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </AnimatedCard>
      )}

      {/* Transient notice (declined / expired / offline). */}
      {!incoming && !outgoing && notice && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
    gap: 10,
    ...THEME.shadows.modal,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  meta: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  swords: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 11,
  },
  acceptText: {
    fontFamily: THEME.fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  declineBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  notice: {
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noticeText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
