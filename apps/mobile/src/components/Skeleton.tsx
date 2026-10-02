import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { THEME } from '../theme';

/**
 * Page skeletons: shimmer placeholders shown while a full page loads,
 * replacing the old centered spinner. Each skeleton mirrors the shape of
 * the content it stands in for (rows, cards, stat boxes) so tab switches
 * feel instant instead of flashing a loader.
 *
 * Deliberately NOT used on the leaderboard: it is a numbered table, so
 * placeholder rank rows would read as real standings. That page shows its
 * header and pills immediately and fills in when the rows land.
 *
 * One shared pulse drives every block (single animation loop, native
 * driver, unmounted with the skeleton).
 */

const usePulse = (): Animated.AnimatedInterpolation<number> => {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
};

interface BlockProps {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  circle?: boolean;
  style?: ViewStyle;
}

const Block: React.FC<BlockProps & { opacity: Animated.AnimatedInterpolation<number> }> = ({
  width = '100%',
  height,
  radius = 6,
  circle = false,
  style,
  opacity,
}) => (
  <Animated.View
    style={[
      styles.block,
      {
        width,
        height,
        borderRadius: circle ? height / 2 : radius,
        opacity,
      },
      style,
    ]}
  />
);

const Row: React.FC<{
  opacity: Animated.AnimatedInterpolation<number>;
  avatarSize?: number;
  lines?: [`${number}%`, `${number}%`];
  action?: boolean;
}> = ({ opacity, avatarSize = 40, lines = ['72%', '46%'], action = false }) => (
  <View style={pageStyles.row}>
    <Block opacity={opacity} height={avatarSize} width={avatarSize} circle />
    <View style={pageStyles.rowLines}>
      <Block opacity={opacity} height={13} width={lines[0]} radius={4} />
      <Block opacity={opacity} height={11} width={lines[1]} radius={4} />
    </View>
    {action && <Block opacity={opacity} height={30} width={64} radius={8} />}
  </View>
);

const SectionLabel: React.FC<{ opacity: Animated.AnimatedInterpolation<number>; width?: `${number}%` }> = ({
  opacity,
  width = '38%',
}) => <Block opacity={opacity} height={12} width={width} radius={4} style={pageStyles.sectionLabel} />;

export const FriendsSkeleton: React.FC = () => {
  const opacity = usePulse();
  return (
    <View style={pageStyles.list}>
      <SectionLabel opacity={opacity} />
      <Row opacity={opacity} action />
      <Row opacity={opacity} action />
      <SectionLabel opacity={opacity} width="30%" />
      <Row opacity={opacity} action />
      <Row opacity={opacity} action />
      <Row opacity={opacity} action />
    </View>
  );
};

export const HistorySkeleton: React.FC = () => {
  const opacity = usePulse();
  return (
    <View style={pageStyles.list}>
      <View style={pageStyles.card}>
        <View style={pageStyles.statRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={pageStyles.statBox}>
              <Block opacity={opacity} height={11} width="60%" radius={4} />
              <Block opacity={opacity} height={20} width="45%" radius={4} />
            </View>
          ))}
        </View>
      </View>
      <View style={pageStyles.pillsRow}>
        <Block opacity={opacity} height={30} width={86} radius={15} />
        <Block opacity={opacity} height={30} width={86} radius={15} />
        <Block opacity={opacity} height={30} width={96} radius={15} />
      </View>
      <Row opacity={opacity} />
      <Row opacity={opacity} />
      <Row opacity={opacity} />
      <Row opacity={opacity} />
    </View>
  );
};

export const ProfileSkeleton: React.FC = () => {
  const opacity = usePulse();
  return (
    <View style={pageStyles.list}>
      <View style={pageStyles.card}>
        <View style={pageStyles.identityRow}>
          <Block opacity={opacity} height={56} width={56} radius={10} />
          <View style={pageStyles.rowLines}>
            <Block opacity={opacity} height={16} width="64%" radius={4} />
            <Block opacity={opacity} height={12} width="42%" radius={4} />
          </View>
        </View>
        <View style={pageStyles.statRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={pageStyles.statBox}>
              <Block opacity={opacity} height={18} width="50%" radius={4} />
              <Block opacity={opacity} height={10} width="65%" radius={4} />
            </View>
          ))}
        </View>
      </View>
      <Block opacity={opacity} height={150} radius={8} />
      <Row opacity={opacity} />
      <Row opacity={opacity} />
      <Row opacity={opacity} />
    </View>
  );
};

export const PlayerProfileSkeleton: React.FC = () => {
  const opacity = usePulse();
  return (
    <View style={pageStyles.list}>
      <View style={pageStyles.card}>
        <View style={pageStyles.identityRow}>
          <Block opacity={opacity} height={56} width={56} radius={8} />
          <View style={pageStyles.rowLines}>
            <Block opacity={opacity} height={16} width="60%" radius={4} />
            <Block opacity={opacity} height={12} width="38%" radius={4} />
          </View>
        </View>
        <View style={pageStyles.statRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={pageStyles.statBox}>
              <Block opacity={opacity} height={18} width="50%" radius={4} />
              <Block opacity={opacity} height={10} width="60%" radius={4} />
            </View>
          ))}
        </View>
      </View>
      <View style={pageStyles.card}>
        <SectionLabel opacity={opacity} width="44%" />
        <View style={pageStyles.statRow}>
          {[0, 1, 2].map((i) => (
            <Block key={i} opacity={opacity} height={44} radius={6} style={pageStyles.h2hBox} />
          ))}
        </View>
      </View>
      <Row opacity={opacity} />
      <Row opacity={opacity} />
      <Row opacity={opacity} />
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: THEME.colors.surfaceHairline,
  },
});

const pageStyles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sectionLabel: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    padding: 12,
  },
  rowLines: {
    flex: 1,
    gap: 7,
  },
  card: {
    backgroundColor: THEME.colors.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.surfaceMuted,
    padding: 16,
    gap: 14,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    backgroundColor: THEME.colors.surfaceMuted,
    borderRadius: 6,
    paddingVertical: 12,
  },
  h2hBox: {
    flex: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
