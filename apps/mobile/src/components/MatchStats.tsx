import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OrbIcon } from './OrbIcon';
import { THEME, useStyles } from '../theme';
import { WallIcon } from './WallIcon';

export const COMPACT_STATS_MAX_HEIGHT = 760;

function formatTimer(seconds?: number): string {
  if (seconds === undefined || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * The standard opponent stat stack. Wall inventory on top, clock underneath,
 * exactly as the bot 1v1 HUD. On short 3-4P screens the `compact` variant puts
 * the same two boxes side-by-side so the board and wall tray keep their room.
 */
export const MatchStats: React.FC<{
  wallsRemaining?: number;
  timeLeft?: number;
  ball: string;
  isActive?: boolean;
  bonus?: number | null;
  compact?: boolean;
  /** Fixed width for compact rows that don't live in a flex column. */
  compactWidth?: number;
}> = ({
  wallsRemaining,
  timeLeft,
  ball,
  isActive = false,
  bonus = null,
  compact = false,
  compactWidth,
}) => {
  const styles = useStyles(createStyles);

  if (wallsRemaining === undefined && timeLeft === undefined) return null;

  if (compact) {
    return (
      <View
        style={[
          styles.compactRow,
          compactWidth !== undefined && { width: compactWidth },
        ]}
      >
        {wallsRemaining !== undefined && (
          <View style={styles.compactWallsChip}>
            <WallIcon size={9} color={ball} />
            <Text style={styles.compactWallsText} numberOfLines={1}>
              {wallsRemaining}
            </Text>
          </View>
        )}

        {timeLeft !== undefined && (
          <View
            style={[
              styles.compactTimerChip,
              isActive && styles.compactTimerChipActive,
            ]}
          >
            <OrbIcon
              name="timer-outline"
              size={8}
              color={
                isActive ? THEME.colors.primary : THEME.colors.textMuted
              }
            />
            <Text
              style={[
                styles.compactTimerText,
                isActive && styles.compactTimerTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {formatTimer(timeLeft)}
            </Text>
            {bonus !== null && bonus > 0 && (
              <Text style={styles.compactBonusText}>+{bonus}</Text>
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {wallsRemaining !== undefined && (
        <View style={styles.wallsChip}>
          <WallIcon size={14} color={ball} />
          <Text style={styles.wallsText}>{wallsRemaining}</Text>
        </View>
      )}

      {timeLeft !== undefined && (
        <View style={[styles.timerBox, isActive && styles.timerBoxActive]}>
          <OrbIcon
            name="timer-outline"
            size={14}
            color={
              isActive ? THEME.colors.primary : THEME.colors.textMuted
            }
          />
          <Text
            style={[
              styles.timerText,
              isActive && styles.timerTextActive,
            ]}
          >
            {formatTimer(timeLeft)}
          </Text>
          {bonus !== null && bonus > 0 && (
            <Text style={styles.bonusText}>+{bonus}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    stack: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    wallsChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 68,
      height: 25,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      gap: 4,
    },
    wallsText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 11.5,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    timerBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 68,
      height: 25,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: 'transparent',
      gap: 4,
    },
    timerBoxActive: {
      borderColor: THEME.colors.primary,
    },
    timerText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 12,
      fontWeight: '600',
      color: THEME.colors.textMuted,
      fontVariant: ['tabular-nums'],
    },
    timerTextActive: {
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
    compactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      gap: 4,
      flexShrink: 0,
    },
    compactWallsChip: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 25,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 1,
      gap: 1,
    },
    compactWallsText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 10.5,
      fontWeight: '700',
      color: THEME.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    compactTimerChip: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 25,
      borderRadius: 6,
      backgroundColor: THEME.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: 'transparent',
      paddingHorizontal: 0.5,
      gap: 1,
    },
    compactTimerChipActive: {
      borderColor: THEME.colors.primary,
    },
    compactTimerText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 10,
      fontWeight: '600',
      color: THEME.colors.textMuted,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.2,
    },
    compactTimerTextActive: {
      color: THEME.colors.textPrimary,
      fontWeight: '800',
    },
    compactBonusText: {
      position: 'absolute',
      top: -6,
      right: -3,
      fontFamily: THEME.fonts.bold,
      fontSize: 8,
      fontWeight: '800',
      color: '#FFFFFF',
      backgroundColor: THEME.colors.tertiary,
      borderRadius: 6,
      paddingHorizontal: 3,
      paddingVertical: 1,
      overflow: 'hidden',
    },
    bonusText: {
      fontFamily: THEME.fonts.bold,
      fontSize: 10,
      fontWeight: '700',
      color: THEME.colors.tertiary,
      marginLeft: 2,
    },
  });
