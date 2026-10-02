import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { THEME } from '../theme';
import type { BadgeCategory, BadgeProgress, BadgeTier } from '../network/apiClient';

/**
 * Premium achievement medallions: solid metal rings (bronze → diamond)
 * around a deep disc, replacing the old flat yellow chips. One component
 * renders everywhere badges appear — profile showcase, catalog grid,
 * detail modal, visitor profiles, game-over rewards — so the metal
 * language stays identical.
 */

interface Metal {
  /** Outer ring. */
  ring: string;
  /** Deep inner disc. */
  disc: string;
  /** Glyph + shine tint. */
  face: string;
  label: string;
}

export const METALS: Record<BadgeTier, Metal> = {
  bronze: { ring: '#C98A4B', disc: '#4A2E14', face: '#F3D3A7', label: 'BRONZE' },
  silver: { ring: '#B9C2CC', disc: '#39434E', face: '#E8EDF2', label: 'SILVER' },
  gold: { ring: '#E3B341', disc: '#5E4510', face: '#FBEFC3', label: 'GOLD' },
  platinum: { ring: '#BFE3DE', disc: '#274744', face: '#E6FAF6', label: 'PLATINUM' },
  diamond: { ring: '#8FB8FF', disc: '#1D3A6B', face: '#D8E9FF', label: 'DIAMOND' },
};

const LOCKED: Metal = {
  ring: THEME.colors.boardBorder,
  disc: THEME.colors.surfaceMuted,
  face: THEME.colors.textMuted,
  label: 'LOCKED',
};

export const tierOf = (tier?: BadgeTier): BadgeTier =>
  tier && METALS[tier] ? tier : 'bronze';

interface MedalProps {
  icon: string;
  tier?: BadgeTier;
  size?: number;
  locked?: boolean;
}

export const AchievementMedal: React.FC<MedalProps> = ({
  icon,
  tier,
  size = 56,
  locked = false,
}) => {
  const metal = locked ? LOCKED : METALS[tierOf(tier)];
  const ringWidth = Math.max(2, Math.round(size * 0.07));
  return (
    <View
      style={[
        styles.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: metal.ring,
          backgroundColor: metal.disc,
        },
      ]}
    >
      <Feather
        name={(locked ? 'lock' : icon) as 'award'}
        size={Math.round(size * 0.4)}
        color={metal.face}
      />
    </View>
  );
};

export const CATEGORY_META: Record<
  BadgeCategory,
  { title: string; icon: keyof typeof Feather.glyphMap }
> = {
  streak: { title: 'WIN STREAKS', icon: 'zap' },
  rank: { title: 'BOARD RANKS', icon: 'chevrons-up' },
  milestone: { title: 'MILESTONES', icon: 'flag' },
  mastery: { title: 'AI MASTERY', icon: 'cpu' },
};

export const CATEGORY_ORDER: BadgeCategory[] = ['streak', 'rank', 'milestone', 'mastery'];

export const categoryOf = (category?: BadgeCategory): BadgeCategory =>
  category && CATEGORY_META[category] ? category : 'mastery';

/** Thin locked-badge progress bar (current/target from the server). */
export const BadgeProgressBar: React.FC<{ progress: BadgeProgress; tier?: BadgeTier }> = ({
  progress,
  tier,
}) => {
  const metal = METALS[tierOf(tier)];
  const pct = progress.target > 0 ? Math.min(1, progress.current / progress.target) : 0;
  return (
    <View style={barStyles.wrap}>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: metal.ring }]} />
      </View>
      <Text style={barStyles.label}>
        {progress.current}/{progress.target}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  medal: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const barStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  track: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: THEME.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  label: {
    fontFamily: THEME.fonts.semiBold,
    fontSize: 10,
    fontWeight: '600',
    color: THEME.colors.textSecondaryStrong,
    fontVariant: ['tabular-nums'],
  },
});
