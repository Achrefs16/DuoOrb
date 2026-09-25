import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME, playerColor } from '../theme';

interface PlayerAvatarOrbProps {
  size?: number;
  color?: string;
  initial?: string;
}

export const PlayerAvatarOrb: React.FC<PlayerAvatarOrbProps> = ({
  size = 36,
  color = THEME.colors.player1,
  initial,
}) => {
  return (
    <View
      style={[
        styles.orbContainer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.orbHighlight,
          {
            width: size * 0.35,
            height: size * 0.28,
            borderRadius: (size * 0.35) / 2,
          },
        ]}
      />
      {initial ? (
        <Text style={[styles.orbInitial, { fontSize: Math.max(11, size * 0.42) }]}>
          {initial.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
};

export type PlayerStatus = 'ONLINE' | 'PLAYING' | 'OFFLINE';

interface StatusDotProps {
  status: PlayerStatus;
  size?: number;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, size = 8 }) => {
  const color =
    status === 'ONLINE'
      ? THEME.colors.statusOnline
      : status === 'PLAYING'
      ? THEME.colors.statusPlaying
      : THEME.colors.statusOffline;

  return (
    <View
      style={[
        styles.statusDot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
};

interface OutcomeBadgeProps {
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  size?: 'sm' | 'md';
}

export const OutcomeBadge: React.FC<OutcomeBadgeProps> = ({ outcome, size = 'md' }) => {
  const isWin = outcome === 'WIN';
  const isLoss = outcome === 'LOSS';

  const bg = isWin ? THEME.colors.winBg : isLoss ? THEME.colors.lossBg : THEME.colors.drawBg;
  const border = isWin ? THEME.colors.winBorder : isLoss ? THEME.colors.lossBorder : THEME.colors.drawBorder;
  const text = isWin ? THEME.colors.win : isLoss ? THEME.colors.loss : THEME.colors.draw;

  return (
    <View
      style={[
        styles.outcomeBadge,
        { backgroundColor: bg, borderColor: border },
        size === 'sm' && styles.outcomeBadgeSm,
      ]}
    >
      <Text style={[styles.outcomeText, { color: text }, size === 'sm' && styles.outcomeTextSm]}>
        {outcome}
      </Text>
    </View>
  );
};

interface PlayerIdentityChipProps {
  username: string;
  rating?: number;
  color?: string;
  status?: PlayerStatus;
  size?: 'sm' | 'md' | 'lg';
  showRating?: boolean;
}

export const PlayerIdentityChip: React.FC<PlayerIdentityChipProps> = ({
  username,
  rating,
  color = THEME.colors.player1,
  status,
  size = 'md',
  showRating = true,
}) => {
  const orbSize = size === 'sm' ? 22 : size === 'lg' ? 44 : 32;

  return (
    <View style={styles.chipRow}>
      <PlayerAvatarOrb size={orbSize} color={color} initial={username.charAt(0)} />
      <View style={styles.chipInfo}>
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.username,
              size === 'sm' && styles.usernameSm,
              size === 'lg' && styles.usernameLg,
            ]}
            numberOfLines={1}
          >
            {username}
          </Text>
          {status && <StatusDot status={status} size={size === 'sm' ? 6 : 8} />}
        </View>
        {showRating && rating !== undefined && (
          <Text style={[styles.rating, size === 'sm' && styles.ratingSm]}>
            {Math.round(rating)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  orbContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...THEME.shadows.orb,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  orbHighlight: {
    position: 'absolute',
    top: '12%',
    left: '16%',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  orbInitial: {
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusDot: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipInfo: {
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontFamily: THEME.fonts.bold,
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  usernameSm: {
    fontSize: 12,
  },
  usernameLg: {
    fontSize: 16,
    fontWeight: '800',
  },
  rating: {
    fontFamily: THEME.fonts.semiBold,
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  ratingSm: {
    fontSize: 10,
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBadgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outcomeText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outcomeTextSm: {
    fontSize: 9,
  },
});
