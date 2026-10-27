import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OrbIcon } from './OrbIcon';
import type { PlayerState } from '@duoorb/game-core';
import { THEME, hexToRgba, playerColor, useStyles } from '../theme';
import { nameInitial } from '../displayName';
import { PremiumBadge } from './PremiumBadge';
import { MatchStats } from './MatchStats';
import { ReactionDock } from './QuickReactions';
import {
  seatStatusLabel,
  type HudSurface,
  type SeatStatus,
} from './GameHud';
import type { IncomingReaction } from '../network/useQuickReactions';
import { useTranslation } from '../i18n';

function formatTimer(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function urgencyColor(seconds?: number): string | null {
  if (seconds === undefined || seconds <= 0) return null;
  if (seconds <= 10) return THEME.colors.danger;
  if (seconds <= 30) return THEME.colors.warning;
  return null;
}


const OnlineSquareAvatar: React.FC<{
  player: PlayerState;
  size: number;
  color: string;
}> = ({ player, size, color }) => {
  const styles = useStyles(createStyles);
  const radius = size >= 52 ? 10 : size >= 40 ? 8 : 6;
  const fontSize = Math.max(15, Math.round(size * 0.46));

  return (
    <View
      style={[
        styles.squareAvatar,
        { width: size, height: size, borderRadius: radius, backgroundColor: color },
      ]}
    >
      <Text
        style={[
          styles.squareAvatarInitial,
          { fontSize, lineHeight: fontSize + 1 },
        ]}
      >
        {nameInitial(player.displayName)}
      </Text>
    </View>
  );
};

const OnlineAvatar: React.FC<{
  player: PlayerState;
  size: number;
  color: string;
  status?: SeatStatus | null;
  onPress?: () => void;
}> = ({ player, size, color, status = null, onPress }) => {
  const styles = useStyles(createStyles);
  const { t } = useTranslation();
  const statusLabel = status ? seatStatusLabel(status, t) : null;
  const identityLabel = onPress
    ? `View ${player.displayName}'s profile`
    : player.displayName || 'Player';
  const label = statusLabel ? `${identityLabel}. ${statusLabel}` : identityLabel;

  const replacement =
    status &&
    (status.kind === 'disconnected' ||
      status.kind === 'reconnecting' ||
      status.kind === 'rejected')
      ? status
      : null;
  const afk = status?.kind === 'afk' ? status : null;
  const tone =
    status?.kind === 'afk'
      ? THEME.colors.warning
      : status
        ? THEME.colors.danger
        : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      style={[styles.avatarFrame, { width: size, height: size }]}
    >
      {replacement ? (
        <View
          style={[
            styles.statusTile,
            {
              width: size,
              height: size,
              borderRadius: size * 0.28,
              backgroundColor: hexToRgba(tone ?? THEME.colors.danger, 0.12),
              borderColor: hexToRgba(tone ?? THEME.colors.danger, 0.45),
            },
          ]}
        >
          <OrbIcon
            name={
              replacement.kind === 'disconnected'
                ? 'wifi-off'
                : replacement.kind === 'reconnecting'
                  ? replacement.offline
                    ? 'wifi-off'
                    : 'refresh-cw'
                  : 'alert-circle'
            }
            size={Math.round(size * 0.38)}
            color={tone ?? THEME.colors.danger}
          />
        </View>
      ) : (
        <OnlineSquareAvatar player={player} size={size} color={color} />
      )}

      {afk && (
        <View style={styles.afkBadge}>
          <OrbIcon name="clock" size={10} color={THEME.colors.onPrimary} />
        </View>
      )}
    </Pressable>
  );
};

interface OnlineSeatProps {
  player: PlayerState;
  compact: boolean;
  compactStats?: boolean;
  isActive: boolean;
  timeLeft?: number;
  status?: SeatStatus | null;
  isPremium?: boolean;
  reactions?: IncomingReaction[];
  onReactionDone?: (id: number) => void;
  onPress?: () => void;
  surface?: HudSurface;
}

const OnlineOpponentSeat: React.FC<OnlineSeatProps> = ({
  player,
  compact,
  compactStats = false,
  isActive,
  timeLeft,
  status = null,
  isPremium = false,
  reactions,
  onReactionDone,
  onPress,
  surface,
}) => {
  const styles = useStyles(createStyles);
  const ball = playerColor(player.index, player.color);
  const dimmed =
    status?.kind === 'disconnected' ||
    status?.kind === 'reconnecting' ||
    status?.kind === 'rejected';

  return (
    <View
      style={[
        styles.seat,
        compact ? styles.seatCompact : styles.seatLarge,
        compactStats && styles.seatCompactStats,
      ]}
    >
      <OnlineAvatar
        player={player}
        size={compact ? (compactStats ? 36 : 46) : 58}
        color={ball}
        status={status}
        onPress={onPress}
      />

      <View style={styles.nameRow}>
        <Text
          onPress={onPress}
          suppressHighlighting
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={onPress ? `View ${player.displayName}'s profile` : undefined}
          style={[
            styles.name,
            compact && styles.nameCompact,
            surface && { color: surface.ink },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {player.displayName}
        </Text>
        {isPremium && <PremiumBadge size={compact ? 'xs' : 'sm'} />}
      </View>

      <View style={[styles.seatMeta, dimmed && styles.metaDimmed]}>
        <MatchStats
          wallsRemaining={player.wallsRemaining}
          timeLeft={timeLeft}
          ball={ball}
          isActive={isActive}
          compact={compactStats}
        />
      </View>

      {reactions && reactions.length > 0 && (
        <ReactionDock
          items={reactions}
          side="top"
          onDone={onReactionDone ?? (() => {})}
          surface={surface}
        />
      )}
    </View>
  );
};

export interface OnlineOpponentRowProps {
  players: PlayerState[];
  compact: boolean;
  compactStats?: boolean;
  timers?: Record<string, number>;
  activeId?: string | null;
  seatStatus: Record<string, SeatStatus>;
  seatPremium: Record<string, boolean>;
  reactionsBySeat: Record<string, IncomingReaction[]>;
  onReactionDone?: (id: number) => void;
  onPressPlayer?: (playerId: string) => void;
  surface?: HudSurface;
}

/**
 * Every online seat uses the standard stat stack: wall box above the clock box.
 * 1v1 aligns it to the right of the duel row; 3-4P centers it under the name.
 * Short 3-4P screens switch to the compact side-by-side stat row.
 */
export const OnlineOpponentRow: React.FC<OnlineOpponentRowProps> = ({
  players,
  compact,
  compactStats = false,
  timers,
  activeId,
  seatStatus,
  seatPremium,
  reactionsBySeat,
  onReactionDone,
  onPressPlayer,
  surface,
}) => {
  const styles = useStyles(createStyles);

  // 1v1 keeps the offline duel geometry: avatar on the left, opponent name
  // in the middle, walls and clock stacked on the right. It is deliberately
  // not the centered 3-4P column.
  if (!compact && players.length === 1) {
    const player = players[0];
    const ball = playerColor(player.index, player.color);
    const status = seatStatus[player.id] ?? null;
    const timeLeft = timers?.[player.id];
    const isActive = activeId === player.id;
    const dimmed =
      status?.kind === 'disconnected' ||
      status?.kind === 'reconnecting' ||
      status?.kind === 'rejected';
    const onPress = onPressPlayer
      ? () => onPressPlayer(player.id)
      : undefined;
    const reactions = reactionsBySeat[player.id];

    return (
      <View style={styles.duelRow}>
        <OnlineAvatar
          player={player}
          size={32}
          color={ball}
          status={status}
          onPress={onPress}
        />

        <View style={styles.duelIdentity}>
          <View style={styles.duelNameRow}>
            <Text
              onPress={onPress}
              suppressHighlighting
              accessibilityRole={onPress ? 'button' : undefined}
              accessibilityLabel={
                onPress ? `View ${player.displayName}'s profile` : undefined
              }
              style={[
                styles.duelName,
                surface && { color: surface.ink },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {player.displayName}
            </Text>
            {seatPremium[player.id] === true && <PremiumBadge size="sm" />}
          </View>
        </View>

        <View style={[styles.duelStats, dimmed && styles.metaDimmed]}>
          <MatchStats
            wallsRemaining={player.wallsRemaining}
            timeLeft={timeLeft}
            ball={ball}
            isActive={isActive}
          />
        </View>

        {reactions && reactions.length > 0 && (
          <ReactionDock
            items={reactions}
            side="top"
            onDone={onReactionDone ?? (() => {})}
            surface={surface}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.row, compactStats && styles.rowCompact]}>
      {players.map((player) => (
        <OnlineOpponentSeat
          key={player.id}
          player={player}
          compact={compact}
          compactStats={compactStats}
          isActive={activeId === player.id}
          timeLeft={timers?.[player.id]}
          status={seatStatus[player.id] ?? null}
          isPremium={seatPremium[player.id] === true}
          reactions={reactionsBySeat[player.id]}
          onReactionDone={onReactionDone}
          onPress={
            onPressPlayer ? () => onPressPlayer(player.id) : undefined
          }
          surface={surface}
        />
      ))}
    </View>
  );
};

export interface OnlineSelfBarProps {
  player: PlayerState;
  isActive: boolean;
  timeLeft?: number;
  status?: SeatStatus | null;
  isPremium?: boolean;
  bonus?: number | null;
  reactions?: IncomingReaction[];
  onReactionDone?: (id: number) => void;
  surface?: HudSurface;
}

/** The bot screen's bottom identity row, kept transparent for online play. */
export const OnlineSelfBar: React.FC<OnlineSelfBarProps> = ({
  player,
  isActive,
  timeLeft,
  status = null,
  isPremium = false,
  bonus = null,
  reactions,
  onReactionDone,
  surface,
}) => {
  const styles = useStyles(createStyles);
  const ball = playerColor(player.index, player.color);
  const urgent = urgencyColor(timeLeft);
  const dimmed =
    status?.kind === 'disconnected' ||
    status?.kind === 'reconnecting' ||
    status?.kind === 'rejected';

  return (
    <View style={styles.selfBar}>
      <View style={styles.selfIdentity}>
        <OnlineAvatar
          player={player}
          size={32}
          color={ball}
          status={status}
        />
        <View style={styles.selfNameRow}>
          <Text
            style={[
              styles.selfName,
              isActive && styles.selfNameActive,
              surface && { color: surface.ink },
            ]}
            numberOfLines={1}
          >
            {player.displayName || 'You'}
          </Text>
          {isPremium && <PremiumBadge size="xs" />}
          {isActive && (
            <View style={[styles.turnDot, { backgroundColor: ball }]} />
          )}
        </View>
      </View>

      {timeLeft !== undefined && (
        <View
          style={[
            styles.selfTimer,
            isActive && styles.selfTimerActive,
            dimmed && styles.metaDimmed,
            surface && { backgroundColor: surface.chip },
          ]}
        >
          <OrbIcon
            name="timer-outline"
            size={15}
            color={
              urgent ??
              (isActive
                ? THEME.colors.primary
                : surface?.subInk ?? THEME.colors.textMuted)
            }
          />
          <Text
            style={[
              styles.selfTimerText,
              isActive && styles.selfTimerTextActive,
              urgent !== null && { color: urgent },
              surface && {
                color: isActive ? THEME.colors.primary : surface.subInk,
              },
            ]}
          >
            {formatTimer(timeLeft)}
          </Text>
          {bonus !== null && bonus > 0 && (
            <Text style={styles.bonus}>+{bonus}</Text>
          )}
        </View>
      )}

      {reactions && reactions.length > 0 && (
        <ReactionDock
          items={reactions}
          side="top"
          onDone={onReactionDone ?? (() => {})}
          surface={surface}
        />
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-start',
      gap: 20,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    rowCompact: {
      gap: 8,
      paddingHorizontal: 6,
      paddingVertical: 4,
    },
    duelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      gap: 8,
      minHeight: 66,
      position: 'relative',
    },
    duelIdentity: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    },
    duelNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
    },
    duelName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      flexShrink: 1,
      minWidth: 0,
    },
    duelStats: {
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 4,
      flexShrink: 0,
    },

    seat: {
      alignItems: 'center',
      gap: 3,
      position: 'relative',
    },
    seatCompact: {
      minWidth: 70,
      maxWidth: 98,
    },
    seatCompactStats: {
      flex: 1,
      minWidth: 0,
      maxWidth: 100,
    },
    seatLarge: {
      minWidth: 116,
      maxWidth: 150,
    },
    avatarFrame: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    squareAvatar: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    squareAvatarInitial: {
      width: '100%',
      textAlign: 'center',
      textAlignVertical: 'center',
      includeFontPadding: false,
      fontFamily: THEME.fonts.extraBold,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.5,
    },
    statusTile: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    afkBadge: {
      position: 'absolute',
      right: -3,
      bottom: -3,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: THEME.colors.warning,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      maxWidth: '100%',
      minWidth: 0,
    },
    name: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: THEME.colors.textSecondary,
      textAlign: 'center',
      flexShrink: 1,
      minWidth: 0,
    },
    nameCompact: {
      fontSize: 11,
    },
    seatMeta: {
      width: '100%',
      alignItems: 'center',
    },
    metaDimmed: {
      opacity: 0.55,
    },
    bonus: {
      fontFamily: THEME.fonts.bold,
      fontSize: 10,
      fontWeight: '700',
      color: THEME.colors.tertiary,
      marginLeft: 1,
    },
    selfBar: {
      width: '100%',
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 6,
      position: 'relative',
    },
    selfIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    selfNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
      flexShrink: 1,
    },
    selfName: {
      fontFamily: THEME.fonts.bold,
      fontSize: 13,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: 160,
    },
    selfNameActive: {
      fontWeight: '800',
    },
    turnDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      flexShrink: 0,
    },
    selfTimer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      width: 72,
      height: 28,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: 'transparent',
      flexShrink: 0,
      marginLeft: 8,
    },
    selfTimerActive: {
      borderColor: THEME.colors.primary,
    },
    selfTimerText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      fontWeight: '600',
      color: THEME.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    selfTimerTextActive: {
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
  });
