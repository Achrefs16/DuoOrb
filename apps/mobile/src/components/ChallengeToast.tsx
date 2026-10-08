import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { ChallengeDto } from '@duoorb/protocol';
import { THEME, useStyles } from '../theme';
import { useTranslation } from '../i18n';
import { modeLabel } from '../matchModes';
import { OutgoingChallenge } from '../network/useChallenge';
import {
  ToastAccept,
  ToastAnimatedCard,
  ToastCard,
  ToastDecline,
  ToastNotice,
  ToastOverlay,
} from './ui';

interface ChallengeToastProps {
  incoming: ChallengeDto | null;
  outgoing: OutgoingChallenge | null;
  notice: string | null;
  /** Accepted challenge waiting on its first sync — accept already happened. */
  joining: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancelWaiting: () => void;
  onCancelJoining: () => void;
}

function clockLabel(minutes: number, incrementSeconds: number): string {
  return `${minutes}+${incrementSeconds}`;
}

export const ChallengeToast: React.FC<ChallengeToastProps> = ({
  incoming,
  outgoing,
  notice,
  joining,
  onAccept,
  onDecline,
  onCancelWaiting,
  onCancelJoining,
}) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  if (!incoming && !outgoing && !notice && !joining) return null;

  return (
    <ToastOverlay top={64}>
      {/* Joining an accepted challenge — the game screen is entered with the
          board, so this spinner in place is the whole wait. No page. */}
      {joining && (
        <ToastAnimatedCard>
          <ToastCard
            radius={THEME.radius.toast}
            padding={14}
            borderColor={THEME.colors.surfacePrimaryTintBorderSoft}
          >
            <View style={styles.topRow}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1}>
                  {t('challengeToast.joining')}
                </Text>
                <Text style={styles.sub}>{t('challengeToast.gettingReady')}</Text>
              </View>
              <ToastDecline label={t('report.cancel')} onPress={onCancelJoining} />
            </View>
          </ToastCard>
        </ToastAnimatedCard>
      )}
      {/* Incoming challenge — Accept starts the game, Decline stops it. */}
      {incoming && (
        <ToastAnimatedCard>
          <ToastCard
            radius={THEME.radius.toast}
            padding={14}
            borderColor={THEME.colors.surfacePrimaryTintBorderSoft}
            style={styles.card}
          >
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
                <Text style={styles.sub}>{t('challengeToast.wantsToPlay')}</Text>
              </View>
              <View style={styles.swords}>
                <MaterialCommunityIcons name="sword-cross" size={20} color={THEME.colors.primary} />
              </View>
            </View>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{modeLabel(incoming.mode)}</Text>
              </View>
              <View style={styles.pill}>
                <Feather name="clock" size={11} color={THEME.colors.textOnMuted} />
                <Text style={styles.pillText}>
                  {clockLabel(incoming.timeControlMinutes, incoming.incrementSeconds)}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {incoming.wallsEach >= 99
                    ? t('challengeToast.infiniteWalls')
                    : t('challengeToast.wallsCount', { count: incoming.wallsEach })}
                </Text>
              </View>
            </View>
            <View style={styles.btnRow}>
              <ToastAccept
                label={t('challengeToast.accept')}
                onPress={onAccept}
                flex
                icon={<Feather name="check" size={15} color={THEME.colors.onPrimary} />}
              />
              <ToastDecline label={t('challengeToast.decline')} onPress={onDecline} />
            </View>
          </ToastCard>
        </ToastAnimatedCard>
      )}

      {/* Outgoing — waiting with cancel. */}
      {!incoming && outgoing && (
        <ToastAnimatedCard>
          <ToastCard
            radius={THEME.radius.toast}
            padding={14}
            borderColor={THEME.colors.surfacePrimaryTintBorderSoft}
          >
            <View style={styles.topRow}>
              <ActivityIndicator size="small" color={THEME.colors.primary} />
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={1}>
                  {t('challengeToast.waitingFor', { name: outgoing.toName })}
                </Text>
                <Text style={styles.sub}>
                  {modeLabel(outgoing.challenge.mode)} ·{' '}
                  {clockLabel(
                    outgoing.challenge.timeControlMinutes,
                    outgoing.challenge.incrementSeconds
                  )}
                </Text>
              </View>
              <ToastDecline label={t('report.cancel')} onPress={onCancelWaiting} />
            </View>
          </ToastCard>
        </ToastAnimatedCard>
      )}

      {/* Transient notice (declined / expired / offline). */}
      {!incoming && !outgoing && !joining && notice && <ToastNotice message={notice} />}
    </ToastOverlay>
  );
};

const createStyles = () => StyleSheet.create({
  card: { maxWidth: 380, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: THEME.colors.surfacePrimaryTint,
    borderWidth: 1,
    borderColor: THEME.colors.surfacePrimaryTintBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: THEME.fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.primaryDark,
  },
  meta: { flex: 1, gap: 1 },
  title: {
    fontFamily: THEME.fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.inverseLabel,
  },
  sub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondaryStrong,
  },
  swords: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.surfacePrimaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: THEME.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textOnMuted,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
});
